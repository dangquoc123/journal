'use client';
import { useRef, useState, useEffect } from 'react';
import { X, Check, RefreshCw } from 'lucide-react';

export default function CameraCapture({ onCapture, onClose }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(e => console.error(e));
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);
    canvasRef.current.toBlob(blob => {
       if(blob) setCaptured(URL.createObjectURL(blob));
    }, 'image/jpeg');
  };

  const confirm = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
        if(blob) onCapture(new File([blob], "cam.jpg", { type: "image/jpeg" }));
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <div className="relative w-full h-full max-w-md bg-black">
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${captured ? 'hidden' : 'block'}`} />
        <canvas ref={canvasRef} className="hidden" />
        {captured && <img src={captured} className="w-full h-full object-cover" />}
        
        <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full"><X/></button>

        <div className="absolute bottom-10 w-full flex justify-center gap-6">
            {!captured ? (
                <button onClick={takePhoto} className="w-20 h-20 border-4 border-white rounded-full bg-white/20"></button>
            ) : (
                <>
                    <button onClick={() => setCaptured(null)} className="bg-gray-600 text-white p-4 rounded-full"><RefreshCw/></button>
                    <button onClick={confirm} className="bg-yellow-500 text-black p-4 rounded-full"><Check/></button>
                </>
            )}
        </div>
      </div>
    </div>
  );
}