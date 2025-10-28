from flask import redirect, session, url_for
from functools import wraps
from app.config import supabase

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        access_token = session.get('access_token')
        try:
            if not access_token:
                return redirect(url_for('auth.sign_in'))
            response = supabase.auth.get_user(access_token)
            return f(*args, **kwargs)
        except Exception as e:
            return 'Erro: ' + str(e)
    return decorated_function

def logout_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            if 'access_token' in session:
                return redirect(url_for('game.homepage'))
            return f(*args, **kwargs)
        except Exception as e:
            return 'Erro: ' + str(e)
    return decorated_function