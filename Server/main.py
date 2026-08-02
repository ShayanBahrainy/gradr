from flask import Flask, request, make_response, jsonify, abort

from werkzeug.middleware.proxy_fix import ProxyFix

import functools

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, Date, String, ForeignKey, Float, DateTime, func, UniqueConstraint, select, union
from sqlalchemy.orm import relationship

from sqlalchemy.orm import DeclarativeBase

import uuid

from dotenv import load_dotenv

import os

load_dotenv()

from verification import Verifier, Verification

class Base(DeclarativeBase):
  pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get("DB_URI")
limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri="memory://"
)

verifier = Verifier()

class Student(db.Model):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False)

class Enrollment(db.Model):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint('student_id', 'course_id'),)

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    student_id = Column(Integer, ForeignKey('students.id'), nullable=False)

    student = relationship('Student', backref='enrollments')
    course = relationship('Course', backref='enrollments')

    date = Column(Date, server_default=func.now())

class Course(db.Model):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    teacher_name = Column(String(50), nullable=False)

    first_seen = Column(Date, server_default=func.now())

class Assignment(db.Model):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True)

    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    course = relationship('Course', backref='assignments')

    description = Column(String())
    notes = Column(String())

    date = Column(Date(), nullable=False)
    points_possible = Column(Integer(), nullable=False)

class Score(db.Model):
    __tablename__ = "scores"
    __table_args__ = (UniqueConstraint('student_id', 'assignment_id'),)

    id = Column(Integer, primary_key=True)

    assignment_id = Column(Integer, ForeignKey('assignments.id'), nullable=False)
    assignment = relationship('Assignment', backref='scores')

    student_id = Column(Integer, ForeignKey('students.id'), nullable=False)
    student = relationship('Student', backref='scores')

    @property
    def points_possible(self):
        return self.assignment.points_possible
    
    raw_score = Column(Float, nullable=False)

class GradeSnapshot(db.Model):
    __tablename__ = "grade_snapshots"
    id = Column(Integer, primary_key=True)

    letter = Column(String(2))
    numeric = Column(Float())

    enrollment_id = Column(Integer, ForeignKey('enrollments.id'), nullable=False)
    enrollment = relationship('Enrollment', backref="grade_snapshots")

    time = Column(DateTime, server_default=func.now())

class AuthenticationKey(db.Model):
    __tablename__ = "authentication_keys"
    key = Column(String(36), primary_key=True)

    student_id = Column(Integer, ForeignKey('students.id'), nullable=False)
    student = relationship('Student')

    issued = Column(DateTime, server_default=func.now())

    @staticmethod
    def generate_key() -> str:
        return str(uuid.uuid4())

def check_authentication(func: function) -> function:
    @functools.wraps(func)
    def wrapped(*args, **kargs):
        if "authentication_key" not in request.json:
            abort(400)

        if len(request.json["authentication_key"]) != 36:
            abort(400)

        authentication_key = db.session.execute(select(AuthenticationKey).where(AuthenticationKey.key == request.json["authentication_key"])).one_or_none()
        if not authentication_key:
            abort(401)

        return func(authentication_key, *args, **kargs)
    return wrapped

def numeric_to_letter_grade(numeric: float) -> str:
    numeric = round(numeric)
    if numeric >= 93:
        return 'A'
    if numeric >= 90:
        return 'A-'
    if numeric >= 87:
        return 'B+'
    if numeric >= 83:
        return 'B'
    if numeric >= 80:
        return 'B-'
    if numeric >= 77:
        return 'C+'
    if numeric >= 73:
        return 'C'
    if numeric >= 70:
        return 'C-'
    if numeric >= 67:
        return 'D+'
    if numeric >= 63:
        return 'D'
    if numeric >= 60:
        return 'D-'
    return 'F'

def get_user_id() -> int:
    if "authentication_key" not in request.json:
        abort(400)

    if len(request.json["authentication_key"]) != 36:
        abort(400)
    
    query = select(AuthenticationKey).where(AuthenticationKey.key == request.json["authentication_key"])

    authentication_key = db.session.execute(query).scalars().one_or_none()
    if not authentication_key:
        abort(400)

    return authentication_key.student_id

def course_data(course: Course) -> dict:
    subq = select(GradeSnapshot.numeric).join(GradeSnapshot.enrollment).where(Enrollment.course_id == course.id).distinct(GradeSnapshot.enrollment_id).order_by(GradeSnapshot.enrollment_id, GradeSnapshot.time.desc()).subquery()
    
    query = select(func.avg(subq.c.numeric), func.count()).select_from(subq)

    numeric, sample_count = db.session.execute(query).one()

    course_data = {
        "name": course.name,
        "id": course.id,
        "teacher_name": course.teacher_name,
        "numeric": numeric or 0.0,
        "sample_count": sample_count or 0,
        "letter": numeric_to_letter_grade(numeric or 0.0),
    }

    return course_data


@app.route("/authenticate/verify/", methods=["POST"])
@limiter.limit("30/minute")
def verify():
    if "code" not in request.json:
        abort(400)
    if "email" not in request.json:
        abort(400)

    code = request.json["code"]
    email = request.json["email"]

    result = verifier.complete_verification(code, email)
    if result.status == Verification.NOT_FOUND:
        abort(400)
    
    if result.status == Verification.EXPIRED:
        response = {
            "result" : "Expired"
        }
        return jsonify(response)
    
    if result.status == Verification.VERIFIED:

        student = db.session.execute(db.select(Student).filter_by(id=result.user_id)).one_or_none()
        if not student:
            student = Student()
            student.email = email
            student.id = result.user_id
            student.name = result.full_name

            db.session.add(student)

        key = AuthenticationKey()
        key.key = AuthenticationKey.generate_key()
        key.student_id = result.user_id

        db.session.add(key)

        response = {}

        response["result"] = "Verified"
        response["authentication_key"] = key.key

        db.session.commit()
    
        return jsonify(response)
    abort(400)

@limiter.limit("1/minute")
@app.route("/authenticate/check/", methods=["POST"])
@limiter.limit("30/minute")
def authentication_check():
    if "authentication_key" not in request.json:
        abort(400)

    if len(request.json["authentication_key"]) != 36:
        return False

    authentication_key = db.session.execute(db.session.select(AuthenticationKey).filter_by(key=request.json["authentication_key"])).one_or_none()
    if not authentication_key:
        return False
    return True

@limiter.limit("1/minute")
@app.route("/authenticate/", methods=["POST"])
@limiter.limit("30/minute")
def authenticate():
    page_content: str = request.json["content"] 

    username_marker = "username: \""

    username_index = page_content.find(username_marker)
    if username_index == -1:
        abort(400)
    
    end_index = page_content.find("\"", username_index + len(username_marker))
    if end_index == -1:
        abort(400)
    
    email = page_content[username_index + len(username_marker) : end_index]

    id_marker = "user_id: "
    id_index = page_content.find(id_marker)
    if id_index == -1:
        abort(400)
    
    end_index = page_content.find(",", id_index)
    if end_index == -1:
        abort(400)
    
    id = page_content[id_index + len(id_marker) : end_index]
    try:
        id = int(id)
    except:
        abort(400)
    
    name_marker = "full_name: \""
    name_index = page_content.find(name_marker)
    if name_index == -1:
        abort(400)
    
    end_index = page_content.find("\"", name_index + len(name_marker))

    full_name = page_content[name_index + len(name_marker): end_index]

    result = verifier.start_verification(email, id, full_name)

    if result.status == Verification.CODE_SENT:
        response = {
            "result" : "Verify Email",
            "email" : email

        }
        return jsonify(response)
    
    abort(400)

@app.route("/authenticate/revoke/", methods=["POST"])
@limiter.limit("30/minute")
def revoke_authentication():
    if "authentication_key" not in request.json:
        abort(400)
    
    key = request.json["authentication_key"]
    if len(key) != 36:
        abort(400)
    
    key = db.session.query(AuthenticationKey).filter(AuthenticationKey.key == key).one_or_none()

    if key == None:
        abort(400)
    
    db.session.delete(key)

    db.session.commit()
    
    return '', 200

@app.route("/upload/course_data/", methods=["POST"])
#@limiter.limit("1/minute")
@check_authentication
@limiter.limit("3/minute", key_func=get_user_id)
def course_upload(authentication_key: AuthenticationKey):
    if "courses" not in request.json:
        abort(400)
    
    courses: list = request.json["courses"]

    for course_data in courses:
        enrollment_id = course_data["enrollment_pk"]
        enrollment = db.session.query(Enrollment).filter(Enrollment.id == enrollment_id).one_or_none()
        if not enrollment:
            course = db.session.query(Course).filter(Course.id == course_data["class_pk"]).one_or_none()
            if not course:
                course = Course()
                course.id = course_data["class_pk"]
                course.name = course_data["class_name"]
                course.teacher_name = course_data["teacher_name"]

                db.session.add(course)
            
            enrollment = Enrollment()
            enrollment.id = course_data["enrollment_pk"]
            enrollment.course_id = course.id
            enrollment.student_id = authentication_key.student.id

            db.session.add(enrollment)
        grade_snapshot = GradeSnapshot()
        grade_snapshot.enrollment_id = enrollment.id
        grade_snapshot.letter = course_data["letter_grade"]
        grade_snapshot.numeric = course_data["numeric_grade"]

        db.session.add(grade_snapshot)
    db.session.commit()

    return '', 200

@app.route("/upload/assignment_data/", methods=["POST"])
@limiter.limit("1/minute")
@check_authentication
@limiter.limit("3/minute", key_func=get_user_id)
def assignment_upload(authentication_key: AuthenticationKey):
    if "scores" not in request.json:
        abort(400)
    
    scores: list = request.json["scores"]
    for score_data in scores:
        assignment = db.session.query(Assignment).filter(Assignment.id == score_data["assignment_id"]).one_or_none()
        if not assignment:
            assignment = Assignment()
            assignment.id = score_data["assignment_id"]
            assignment.course_id  = score_data["course_id"]
            assignment.date = score_data["date"]
            assignment.description = score_data["assignment_description"]
            assignment.notes = score_data["assignment_notes"]
            assignment.points_possible = score_data["points_possible"]
            
            db.session.add(assignment)

        score = db.session.query(Score).filter(Score.id == score_data["id"]).one_or_none()
        if not score:
            score = Score()
            score.assignment_id = assignment.id
            score.id = score_data["id"]
            score.raw_score = score_data["raw_score"]
            score.student_id = authentication_key.student_id

            db.session.add(score)
        
        score.raw_score = score_data["raw_score"]

        assignment.description = score_data["assignment_description"]
        assignment.notes = score_data["assignment_notes"]
        assignment.points_possible = score_data["points_possible"]
        assignment.date = score_data["date"]
        
    db.session.commit()

    return '', 200


@app.route("/search/course/<search_query>/", methods=["POST"])
@limiter.limit("20/minute")
@limiter.limit("1/second")
@check_authentication
@limiter.limit("20/minute", key_func=get_user_id)
@limiter.limit("2/second", key_func=get_user_id)
def course_search(authentication_key: AuthenticationKey, search_query: str):
    name_query = select(Course).where(Course.name.ilike(f'%{search_query}%'))
    teacher_query = select(Course).where(Course.teacher_name.ilike(f'%{search_query}%'))

    query = union(name_query, teacher_query)

    courses: list[Course] = db.session.execute(query).all()

    courses_data = []
    for course in courses:
        courses_data.append(course_info(course.id))

    return courses_data
    

@app.route("/course/<course_id>/", methods=["POST"])
@limiter.limit("20/minute")
@limiter.limit("5/second")
@check_authentication
@limiter.limit("30/minute", key_func=get_user_id)
@limiter.limit("5/second", key_func=get_user_id)
def course_info(authentication_key: AuthenticationKey, course_id: str):
    try:
        course_id = int(course_id)
    except:
        abort(400)
    
    query = select(Course).where(Course.id == course_id)

    course: Course = db.session.execute(query).scalars().one_or_none()
    if not course:
        abort(404)

    return course_data(course)

@app.route("/student/gpa/", methods=["POST"])
@check_authentication
@limiter.limit("10/minute", key_func=get_user_id)
@limiter.limit("1/second", key_func=get_user_id)
def fetch_gpa(authentication_key: AuthenticationKey):
    query = select(GradeSnapshot.numeric).join(GradeSnapshot.enrollment).where(Enrollment.course_id == course.id).distinct(GradeSnapshot.enrollment_id).order_by(GradeSnapshot.enrollment_id, GradeSnapshot.time.desc())

    snapshots = db.session.execute(query).scalars().all()

    counted = 0
    points = 0
    bonus = 0
    for snapshot in snapshots:
        letter = (snapshot.letter or "").strip()
        if letter in letter_to_gpa_points:
            counted += 1
            points += letter_to_gpa_points[letter]
            if gets_bonus(snapshot.enrollment.course.name):
                bonus += 1

    result = {
        "weighted": round((points + bonus) / counted if counted != 0 else 0, 2),
        "unweighted": round((points / counted) if counted != 0 else 0, 2),
    }

    return result

@app.route("/privacy.txt")
@limiter.limit("10/minute")
@limiter.limit("1/second")
def privacy_policy():
    return send_file('privacy.txt')

@app.route("/generate_204")
@limiter.limit("60/minute")
def generate_204():
    return Response(status=204)

if __name__ == "__main__":
    db.init_app(app)
    with app.app_context():
        db.create_all()
    app.run()