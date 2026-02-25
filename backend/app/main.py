# ...existing code...
import os
import time
import socket
from urllib.parse import urlparse, urlunparse

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.sql import func

load_dotenv()

# Cấu hình Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

# Kết nối Database (không tạo engine ngay tại import để tránh crash khi container không thể nối)
DATABASE_URL = os.getenv("DATABASE_URL")

def _force_ipv4_database_url(db_url: str) -> str:
    if not db_url:
        return db_url
    try:
        # trim quotes and whitespace
        db_url = db_url.strip()
        if (db_url.startswith('"') and db_url.endswith('"')) or (db_url.startswith("'") and db_url.endswith("'")):
            db_url = db_url[1:-1]

        p = urlparse(db_url)
        host = p.hostname
        port = p.port

        if not host:
            return db_url

        # ưu tiên lookup IPv4
        try:
            infos = socket.getaddrinfo(host, port or 0, family=socket.AF_INET, type=socket.SOCK_STREAM)
            if not infos:
                return db_url
            ipv4 = infos[0][4][0]
        except Exception:
            return db_url

        # rebuild netloc giữ user:pass và port + giữ query (sslmode)
        userinfo = ""
        if p.username:
            userinfo += p.username
            if p.password:
                userinfo += ":" + p.password
            userinfo += "@"
        netloc = f"{userinfo}{ipv4}"
        if port:
            netloc += f":{port}"
        new = p._replace(netloc=netloc)
        return urlunparse(new)
    except Exception:
        return db_url

# Engine and session will be created in startup event
engine = None
SessionLocal = None
Base = declarative_base()

# Models (giữ cấu trúc ban đầu)
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
    media_url = Column(String, nullable=True)
    media_type = Column(String, default="image")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    author_id = Column(Integer, ForeignKey("users.id"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    global engine, SessionLocal
    db_url = DATABASE_URL
    if not db_url:
        print("DATABASE_URL không được cấu hình.")
        return

    db_url_ipv4 = _force_ipv4_database_url(db_url)
    attempts = 6
    wait_seconds = 2
    for i in range(attempts):
        try:
            # recreate engine/session bound to possibly-updated URL
            engine = create_engine(db_url_ipv4, pool_pre_ping=True)
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            Base.metadata.create_all(bind=engine)
            print("Kết nối DB thành công, bảng đã được tạo.")
            return
        except OperationalError as e:
            print(f"[DB] Thử kết nối {i+1}/{attempts} thất bại: {e}")
            time.sleep(wait_seconds)
    print("[DB] Không thể kết nối DB sau nhiều lần thử. Ứng dụng khởi động nhưng DB có thể không hoạt động.")

def get_db():
    if SessionLocal is None:
        raise RuntimeError("Database session chưa sẵn sàng. Chờ startup hoàn tất hoặc kiểm tra cấu hình DATABASE_URL.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API (giữ nguyên logic ban đầu)
@app.post("/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, password=password)
        db.add(user)
        db.commit()
        db.refresh(user)
    if user.password != password:
        raise HTTPException(status_code=400, detail="Sai mật khẩu")
    return {"user_id": user.id, "username": user.username}

@app.get("/diaries")
def get_diaries(db: Session = Depends(get_db)):
    return db.query(Diary).order_by(Diary.created_at.desc()).all()

@app.post("/diaries")
async def create_diary(
    title: str = Form(...),
    content: str = Form(...),
    user_id: int = Form(...),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    media_url = None
    media_type = "text"
    if file:
        try:
            res = cloudinary.uploader.upload(file.file, folder="couple_diary")
            media_url = res.get("secure_url")
            if "video" in res.get("resource_type", ""):
                media_type = "video"
            else:
                media_type = "image"
        except Exception as e:
            print(f"Lỗi upload: {e}")

    diary = Diary(title=title, content=content, author_id=user_id, media_url=media_url, media_type=media_type)
    db.add(diary)
    db.commit()
    db.refresh(diary)
    return diary
# ...existing