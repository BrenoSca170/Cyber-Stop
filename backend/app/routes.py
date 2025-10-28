from app.services.user_service import UserService
from app.decorators import login_required, logout_required
from flask import Blueprint, redirect, render_template, request, session, url_for

bp_auth = Blueprint("auth", __name__)
bp_game = Blueprint("game", __name__)

@bp_auth.route("/sign_up", methods=["GET", "POST"])
@logout_required
def sign_up():
    if request.method == "GET":
        return render_template("sign_up.html")
    else:
        try:
            email = request.form.get("email")
            password = request.form.get("password")
            response = UserService.sign_up(email, password)
            return redirect(url_for("auth.sign_in"))
        except Exception as e:
            return str(e)

@bp_auth.route("/sign_in", methods=["GET", "POST"])
@logout_required
def sign_in():
    if request.method == "GET":
        return render_template("sign_in.html")
    else:
        try:
            email = request.form.get("email")
            password = request.form.get("password")
            response = UserService.sign_in(email, password)
            session['access_token'] = response.session.access_token
            return redirect(url_for("game.homepage"))
        except Exception as e:
            return str(e)

@bp_auth.route('/sign_out', methods=["GET"])
@login_required
def sign_out():
    try:
        session.clear()
        response = UserService.sign_out()
        return render_template("sign_out.html")
    except Exception as e:
        return str(e)
    
@bp_game.route("/homepage", methods=["GET"])
@login_required
def homepage():
    return render_template("homepage.html")