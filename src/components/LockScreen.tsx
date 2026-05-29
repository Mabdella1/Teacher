import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, Unlock } from 'lucide-react';

interface LockScreenProps {
  storedPasscode: string;
  onUnlock: () => void;
  onSetPasscode: (passcode: string) => void;
}

export default function LockScreen({ storedPasscode, onUnlock, onSetPasscode }: LockScreenProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [tempPasscode, setTempPasscode] = useState('');

  const isSetupMode = !storedPasscode;

  const handleKeyPress = (num: string) => {
    if (passcode.length < 4) {
      setPasscode(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPasscode('');
    setError('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (passcode.length !== 4) {
      setError('الرجاء إدخال رمز مكون من 4 أرقام');
      return;
    }

    if (isSetupMode) {
      if (!isConfirming) {
        setTempPasscode(passcode);
        setPasscode('');
        setIsConfirming(true);
      } else {
        if (passcode === tempPasscode) {
          onSetPasscode(passcode);
        } else {
          setError('الرموز غير متطابقة! أعد المحاولة.');
          setPasscode('');
          setIsConfirming(false);
          setTempPasscode('');
        }
      }
    } else {
      if (passcode === storedPasscode) {
        onUnlock();
      } else {
        setError('رمز الدخول غير صحيح! حاول مجدداً.');
        setPasscode('');
      }
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl hover:border-slate-350 transition-all duration-300"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 text-blue-600">
            {isSetupMode ? <KeyRound size={28} /> : <Lock size={28} />}
          </div>
          <h1 className="text-2xl font-black text-blue-950 tracking-wide text-center leading-relaxed">
            {isSetupMode ? 'إعداد رمز الحماية لـ TEACHER' : 'تطبيق TEACHER للمعلم'}
          </h1>
          <p className="text-xs text-slate-500 mt-2 text-center font-medium leading-relaxed">
            {isSetupMode 
              ? (isConfirming ? 'الرجاء تأكيد رمز المرور الخاص بك' : 'قم بتعيين رمز مرور (4 أرقام) لحماية بيانات طلابك وحساباتك')
              : 'نظام حماية البيانات مفعل. أدخل رمز الحماية للمتابعة'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Display Dots */}
          <div className="flex justify-center gap-4 py-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                  passcode.length > idx
                    ? 'bg-blue-600 border-blue-600 scale-110 shadow-[0_0_8px_rgba(37,99,235,0.25)]'
                    : 'border-slate-300 bg-transparent'
                }`}
              />
            ))}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-red-600 text-xs text-center font-extrabold"
            >
              {error}
            </motion.p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {digits.slice(0, 9).map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => handleKeyPress(num)}
                className="h-14 rounded-2xl bg-slate-50 border border-slate-200/85 hover:bg-slate-100 hover:border-slate-300 font-extrabold text-lg text-slate-800 transition-all active:scale-95 duration-100 flex items-center justify-center cursor-pointer"
              >
                {num}
              </button>
            ))}
            
            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-2xl bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 transition-all active:scale-95 duration-100 text-xs font-bold flex items-center justify-center cursor-pointer"
            >
              مسح
            </button>
            
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 rounded-2xl bg-slate-50 border border-slate-200/85 hover:bg-slate-100 hover:border-slate-300 font-extrabold text-lg text-slate-800 transition-all active:scale-95 duration-100 flex items-center justify-center cursor-pointer"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 transition-all active:scale-95 duration-100 text-xs font-semibold flex items-center justify-center cursor-pointer"
            >
              تراجع
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={passcode.length !== 4}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-center transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2"
            >
              <Unlock size={16} />
              <span>{isSetupMode ? (isConfirming ? 'تأكيد الرمز' : 'حفظ ومتابعة') : 'تأكيد رمز الدخول'}</span>
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-[10px] text-slate-400 font-semibold leading-relaxed">
          <span>تطبيق TEACHER للأستاذ الفاضل • حماية وتشفير البيانات محلياً مع المزامنة السحابية</span>
        </div>
      </motion.div>
    </div>
  );
}
