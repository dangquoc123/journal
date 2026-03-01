'use client';
import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Send, Loader2 } from 'lucide-react';
import CameraCapture from './components/CameraCapture';

// Browser luôn gọi qua Next.js proxy, tránh lỗi "backend:8000" không resolve được
const API_URL = "/api/proxy";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [diaries, setDiaries] = useState<any[]>([]);
  const [loginData, setLoginData] = useState({ u: '', p: '' });
  const [form, setForm] = useState({ title: '', content: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [loading, setLoading] = useState(false);

  // AUTO LOGIN (lưu user_id + token)
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (user) fetchDiaries();
  }, [user]);

  const fetchDiaries = () => {
    return fetch(`${API_URL}/diaries`)
      .then(r => r.json())
      .then(setDiaries)
      .catch(err => console.error("fetchDiaries error:", err));
  };

  // LOGIN
  const handleLogin = async (e: any) => {
    e.preventDefault();

    if (!loginData.u || !loginData.p) {
      alert("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }

    const fd = new FormData();
    fd.append('username', loginData.u);
    fd.append('password', loginData.p);

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        body: fd
      });

      if (res.ok) {
        const data = await res.json();
        // data có dạng { token, user_id }
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      } else {
        const errText = await res.text();
        console.error("Login error:", res.status, errText);
        alert(`Đăng nhập thất bại: ${res.status} - Sai tài khoản hoặc mật khẩu`);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      alert(`Lỗi kết nối: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // POST DIARY
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    if (!form.title || !form.content) {
      alert("Vui lòng nhập tiêu đề và nội dung");
      setLoading(false);
      return;
    }

    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('content', form.content);
    // KHÔNG gửi user_id qua form, backend lấy từ JWT token

    if (file) fd.append('file', file);

    try {
      const res = await fetch(`${API_URL}/diaries`, {
        method: 'POST',
        headers: {
          // Gửi JWT token để backend xác thực qua get_current_user
          'Authorization': `Bearer ${user.token}`
        },
        body: fd
      });

      if (res.ok) {
        setForm({ title: '', content: '' });
        setFile(null);
        setPreview(null);
        await fetchDiaries();
      } else {
        const errText = await res.text();
        console.error("Create diary error:", res.status, errText);
        alert("Lỗi khi tạo nhật ký");
      }
    } catch (err) {
      console.error("handleSubmit error:", err);
      alert(`Lỗi kết nối: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // LOGOUT
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  // LOGIN UI
  if (!user) return (
    <div className="h-screen flex items-center justify-center bg-pink-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow w-80 space-y-4">
        <h1 className="text-2xl font-bold text-pink-600 text-center">
          Couple Diary 💖
        </h1>

        <input
          className="border w-full p-2 rounded text-black"
          placeholder="Tên"
          value={loginData.u}
          onChange={e => setLoginData({ ...loginData, u: e.target.value })}
        />

        <input
          className="border w-full p-2 rounded text-black"
          type="password"
          placeholder="Mật khẩu"
          value={loginData.p}
          onChange={e => setLoginData({ ...loginData, p: e.target.value })}
        />

        <button className="bg-pink-500 text-white w-full py-2 rounded font-bold hover:bg-pink-600">
          Vào Nhà
        </button>
      </form>
    </div>
  );

  // MAIN UI
  return (
    <main className="min-h-screen bg-gray-50 pb-20 p-4 text-black">
      {cam && (
        <CameraCapture
          onCapture={(f: File) => {
            setFile(f);
            setPreview(URL.createObjectURL(f));
            setCam(false);
          }}
          onClose={() => setCam(false)}
        />
      )}

      <div className="max-w-md mx-auto">

        {/* HEADER WITH LOGOUT */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-pink-600">Couple Diary 💖</h1>
          <button
            onClick={handleLogout}
            className="text-sm bg-pink-100 text-pink-600 px-3 py-1 rounded hover:bg-pink-200"
          >
            Đăng xuất
          </button>
        </div>

        {/* CREATE DIARY */}
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">

            <input
              className="w-full font-bold outline-none text-black"
              placeholder="Tiêu đề..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />

            <textarea
              className="w-full h-20 resize-none outline-none text-black"
              placeholder="Viết gì đi..."
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
            />

            {preview && (
              <img src={preview} className="w-full h-40 object-cover rounded" alt="Preview" />
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={() => setCam(true)}
                  className="flex gap-1 bg-pink-50 text-pink-600 px-3 py-2 rounded text-sm hover:bg-pink-100"
                >
                  <Camera size={16} /> Locket
                </button>

                <label className="flex gap-1 bg-gray-100 text-black px-3 py-2 rounded text-sm cursor-pointer hover:bg-gray-200">
                  <ImageIcon size={16} /> Ảnh
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={e => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        setPreview(URL.createObjectURL(e.target.files[0]));
                      }
                    }}
                  />
                </label>

              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </form>
        </div>

        {/* DIARY LIST */}
        <div className="space-y-4">
          {diaries && diaries.length > 0 ? (
            diaries.map((d: any) => (
              <div key={d.id} className="bg-white rounded-xl shadow overflow-hidden">

                <div className="p-3 border-b flex justify-between">
                  <span className="font-bold text-black">{d.title}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {d.media_url && (
                  d.media_type === 'video'
                    ? <video src={d.media_url} controls className="w-full" />
                    : <img src={d.media_url} className="w-full" alt={d.title} />
                )}

                <div className="p-3 text-gray-700 whitespace-pre-line">
                  {d.content}
                </div>

              </div>
            ))
          ) : (
            <div className="text-center py-10 text-gray-500">
              Chưa có nhật ký nào. Bắt đầu viết nào! 📝
            </div>
          )}
        </div>

      </div>
    </main>
  );
}