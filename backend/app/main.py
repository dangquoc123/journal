import os
import time
import socket
from urllib.parse import urlparse, urlunparse
from datetime import datetime, timedelta

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.sql import func
from jose import JWTError, jwt
import bcrypt

load_dotenv()

# ================= CLOUDINARY =================
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

# ================= JWT CONFIG =================
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

security = HTTPBearer()

# ================= DATABASE =================
DATABASE_URL = os.getenv("DATABASE_URL")

def _force_ipv4_database_url(db_url: str) -> str:
    if not db_url:
        return db_url
    try:
        p = urlparse(db_url)
        infos = socket.getaddrinfo(p.hostname, p.port or 0, family=socket.AF_INET, type=socket.SOCK_STREAM)
        ipv4 = infos[0][4][0]

        userinfo = ""
        if p.username:
            userinfo += p.username
            if p.password:
                userinfo += ":" + p.password
            userinfo += "@"

        netloc = f"{userinfo}{ipv4}"
        if p.port:
            netloc += f":{p.port}"

        return urlunparse(p._replace(netloc=netloc))
    except:
        return db_url

engine = None
SessionLocal = None
Base = declarative_base()

# ================= MODELS =================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

class Diary(Base):
    __tablename__ = "diaries"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    media_url = Column(String)
    media_type = Column(String, default="image")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    author_id = Column(Integer, ForeignKey("users.id"))

# ================= APP =================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= DB STARTUP =================
@app.on_event("startup")
def startup():
    global engine, SessionLocal

    if not DATABASE_URL:
        print("❌ DATABASE_URL missing")
        return

    db_url = _force_ipv4_database_url(DATABASE_URL)

    for _ in range(6):
        try:
            engine = create_engine(db_url, pool_pre_ping=True)
            SessionLocal = sessionmaker(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("✅ DB connected")
            return
        except OperationalError:
            time.sleep(2)

def get_db():
    if not SessionLocal:
        raise HTTPException(500, "Database not ready")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ================= JWT UTILS =================
def create_token(user_id: int):
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload["user_id"]
    except JWTError:
        raise HTTPException(401, "Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found")

    return user

# ================= AUTH =================
@app.post("/register")
def register(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=username).first():
        raise HTTPException(400, "Username exists")

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    user = User(username=username, password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Trả về token + user_id để frontend lưu và dùng cho các request tiếp theo
    return {"token": create_token(user.id), "user_id": user.id}

@app.post("/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(400, "User not found")

    try:
        if not bcrypt.checkpw(password.encode(), user.password.encode()):
            raise HTTPException(400, "Wrong password")
    except:
        raise HTTPException(400, "Password corrupted")

    # Trả về token + user_id để frontend lưu và dùng cho các request tiếp theo
    return {"token": create_token(user.id), "user_id": user.id}

# ================= DIARIES =================
@app.get("/diaries")
def get_diaries(db: Session = Depends(get_db)):
    return db.query(Diary).order_by(Diary.created_at.desc()).all()

@app.post("/diaries")
async def create_diary(
    title: str = Form(...),
    content: str = Form(...),
    file: UploadFile = File(None),
    # Xác thực user qua JWT Bearer token trong header Authorization
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media_url = None
    media_type = "text"

    if file:
        res = cloudinary.uploader.upload(file.file, folder="couple_diary")
        media_url = res["secure_url"]
        media_type = "video" if "video" in res["resource_type"] else "image"

    diary = Diary(
        title=title,
        content=content,
        author_id=current_user.id,
        media_url=media_url,
        media_type=media_type,
    )

    db.add(diary)
    db.commit()
    db.refresh(diary)

    return diary