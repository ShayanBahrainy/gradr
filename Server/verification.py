import resend
import os
import re
import secrets
import time

resend.api_key = os.environ.get('RESEND_API_KEY')

class VerificationStatus:
    INVALID_EMAIL = 0
    CODE_SENT = 1
    VERIFIED = 2
    EXPIRED = 3
    NOT_FOUND = 4

class Verification:
    INVALID_EMAIL = 0
    CODE_SENT = 1
    VERIFIED = 2
    EXPIRED = 3
    NOT_FOUND = 4

    def __init__(self, status: int, user_id: int=None, full_name: str=None):
        self.status = status
        self.user_id = user_id
        self.full_name = full_name

class Verifier:
    EMAIL_REGEX = "^[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,6}$"
    def __init__(self):
        self.requests = {}
        self.email_to_code = {}

    @staticmethod
    def generate_code() -> str:
        num = secrets.randbelow(1000000)
        return str(num).zfill(6)
    
    def start_verification(self, email_address: str, user_id: int, full_name: str):
        if not re.match(self.EMAIL_REGEX, email_address):
            return Verification(Verification.INVALID_EMAIL)
        
        if email_address in self.email_to_code and self.email_to_code[email_address] in self.requests:
            del self.requests[self.email_to_code[email_address]]
            del self.email_to_code[email_address]

        code = self.generate_code()
        self.requests[code] = [email_address, time.time(), user_id, full_name]
        self.email_to_code[email_address] = code

        email = {}
        email["to"] = email_address 
        email["from"] = os.environ.get("RESEND_FROM_ADDRESS")

        email["subject"] = "verify your email for gradr"

        email["html"] = f"<p>hello! <br> your verification code for gradr is {code} <br> thanks. </p>"

        resend.Emails.send(email)

        return Verification(Verification.CODE_SENT)
    
    def complete_verification(self, code: str, email: str):
        if not self.requests.__contains__(code):
            verification =  Verification(Verification.NOT_FOUND)
            return verification
        elif self.requests[code][0] != email:
            verification = Verification(Verification.NOT_FOUND)
            return verification
        elif self.requests[code][1] - time.time() > 60 * 10:
            verification = Verification(Verification.EXPIRED)
            del self.requests[code]
            del self.email_to_code[email]
            return verification

        verification = Verification(Verification.VERIFIED, self.requests[code][2], self.requests[code][3])
        del self.requests[code]
        del self.email_to_code[email]
        return verification
        