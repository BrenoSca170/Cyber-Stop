from app.config import supabase

class UserService:

    @staticmethod
    def sign_up(email: str, password: str):
        return supabase.auth.sign_up(
            {
                "email": email,
                "password": password,
            }
        )
    
    @staticmethod
    def sign_in(email: str, password: str):
        return supabase.auth.sign_in_with_password(
            {
                "email": email,
                "password": password,
            }
        )
    
    @staticmethod
    def sign_out():
        return supabase.auth.sign_out()