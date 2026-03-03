import React from 'react';
import { Timer } from 'lucide-react';

interface Props {
    hrs: number;
    mins: number;
}

export default function ArcadeCooldown({ hrs, mins }: Props) {
    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12 rounded-2xl text-center border-2 border-gray-200 shadow-xl animate-in zoom-in-95">
            <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Timer className="w-14 h-14 text-violet-500 animate-pulse"/>
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-gray-800 mb-3">وقت الراحة! ☕</h3>
            <p className="text-gray-600 font-bold mb-6 max-w-md mx-auto">
                لقد استهلكت محاولتك. خذ استراحة وتعال تلعب مرة تانية بعد:
            </p>
            <div className="inline-flex items-center gap-4 text-4xl font-black text-violet-600 bg-white py-5 px-8 rounded-3xl shadow-lg border-2 border-violet-100">
                <div className="text-center">
                    <div className="text-5xl">{hrs}</div>
                    <div className="text-xs font-bold text-violet-400 mt-1">ساعة</div>
                </div>
                <span className="text-violet-300">:</span>
                <div className="text-center">
                    <div className="text-5xl">{mins}</div>
                    <div className="text-xs font-bold text-violet-400 mt-1">دقيقة</div>
                </div>
            </div>
            <div className="mt-8 flex justify-center gap-2">
                <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce delay-200"></div>
            </div>
        </div>
    );
}
