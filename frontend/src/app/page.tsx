'use client';
import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Send, Loader2 } from 'lucide-react';
import CameraCapture from './components/CameraCapture';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [diaries, setDiaries] = useState<any[]>([]);
  const [loginData, setLoginData] = useState({ u: '', p: '' });
  const [form, setForm] = useState({ title: '', content: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) fetchDiaries(); }, [user]);

  const fetchDiaries = () => fetch(`${API_URL}/diaries`).then(r => r.json()).then(setDiaries);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(); fd.append('username', loginData.u); fd.append('password', loginData.p);
    const res = await fetch(`${API_URL}/login`, { method: 'POST', body: fd });
    if (res.ok) setUser(await res.json());
    else alert("Lỗi đăng nhập");
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(); 
    fd.append('title', form.title); fd.append('content', form.content); fd.append('user_id', user.user_id);
    if (file) fd.append('file', file);
    await fetch(`${API_URL}/diaries`, { method: 'POST', body: fd });
    setForm({ title: '', content: '' }); setFile(null); setPreview(null); setLoading(false);
    fetchDiaries();
  };

  if (!user) return (
    <div className="h-screen flex items-center justify-center bg-pink-50">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow w-80 space-y-4">
        <h1 className="text-2xl font-bold text-pink-600 text-center">Couple Diary 💖</h1>
        <input className="border w-full p-2 rounded" placeholder="Tên" onChange={e => setLoginData({...loginData, u: e.target.value})} />
        <input className="border w-full p-2 rounded" type="password" placeholder="Mật khẩu" onChange={e => setLoginData({...loginData, p: e.target.value})} />
        <button className="bg-pink-500 text-white w-full py-2 rounded font-bold">Vào Nhà</button>
      </form>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 pb-20 p-4">
      {cam && <CameraCapture onCapture={(f: File) => {setFile(f); setPreview(URL.createObjectURL(f)); setCam(false)}} onClose={() => setCam(false)} />}
      
      <div className="max-w-md mx-auto">
        <div className="bg-white p-4 rounded-xl shadow mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input className="w-full font-bold outline-none" placeholder="Tiêu đề..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            <textarea className="w-full h-20 resize-none outline-none" placeholder="Viết gì đi..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} required />
            {preview && <img src={preview} className="w-full h-40 object-cover rounded" />}
            
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex gap-2">
                <button type="button" onClick={() => setCam(true)} className="flex gap-1 bg-pink-50 text-pink-600 px-3 py-2 rounded text-sm"><Camera size={16}/> Locket</button>
                <label className="flex gap-1 bg-gray-100 px-3 py-2 rounded text-sm cursor-pointer"><ImageIcon size={16}/> Ảnh
                  <input type="file" hidden accept="image/*" onChange={e => { if(e.target.files?.[0]) { setFile(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); }}} />
                </label>
              </div>
              <button disabled={loading} className="bg-black text-white px-4 py-2 rounded-full">{loading ? <Loader2 className="animate-spin"/> : <Send size={18}/>}</button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          {diaries.map((d: any) => (
            <div key={d.id} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="p-3 border-b flex justify-between"><span className="font-bold">{d.title}</span><span className="text-xs text-gray-500">{new Date(d.created_at).toLocaleDateString()}</span></div>
              {d.media_url && (d.media_type === 'video' ? <video src={d.media_url} controls className="w-full"/> : <img src={d.media_url} className="w-full"/>)}
              <div className="p-3 text-gray-700 whitespace-pre-line">{d.content}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}