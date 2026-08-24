# gradr
This is a chrome extension to show statistics on Veracross classes/assignments.

# Testing
If you don't want to download from the Chrome Webstore, you can download the latest release (.zip), decompress it, and then in your Chrome extension settings (with developer mode enabled) hit 'load unpacked'.
This depends on access to Veracross to work. If you don't have access to Veracross, you can watch this video:


https://github.com/user-attachments/assets/d13c98bd-6d08-44d8-96b5-751880587ccb

# Server
To run the server you will need a .env file in the main folder with `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, and `DB_URI` set. 
On Python 3.12, run this to setup an environment:
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

To run the server:
```cd Server; python main.py```
