from dotenv import load_dotenv
from flask import Flask
import os

def criar_app():
    app = Flask(__name__)
    load_dotenv()
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.secret_key = os.environ.get('SECRET_KEY', 'default_secret_key')

    from . import routes
    app.register_blueprint(routes.bp_auth, url_prefix="/auth")
    app.register_blueprint(routes.bp_game, url_prefix="/game")

    return app