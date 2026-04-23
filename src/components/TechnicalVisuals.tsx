'use client';

export const DiskVisual = () => (
  <div className="relative w-full h-full flex flex-col items-center justify-center p-12 gap-8">
    <div className="w-full max-w-md h-4 bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-blue-600 w-2/3 shadow-[0_0_20px_rgba(37,99,235,0.5)]" />
    </div>
    <div className="text-center space-y-1">
      <span className="block text-[10px] font-bold text-blue-500 tracking-[0.3em] uppercase">Moteur de Dédoublonnement</span>
      <span className="text-4xl font-black text-white">-60%</span>
    </div>
  </div>
);

export const OAuthVisual = () => (
  <div className="relative group">
     <div className="absolute inset-0 bg-blue-600/20 blur-3xl group-hover:bg-blue-600/30 transition-colors" />
     <div className="relative w-32 h-32 border-2 border-white/10 rounded-3xl bg-zinc-900/50 flex flex-col items-center justify-center gap-2 p-6">
        <div className="grid grid-cols-2 gap-1 w-12 h-12">
           <div className="bg-[#f25022]" />
           <div className="bg-[#7fbb00]" />
           <div className="bg-[#00a4ef]" />
           <div className="bg-[#ffb900]" />
        </div>
        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Microsoft</span>
     </div>
  </div>
);

export const HubVisual = () => (
  <div className="relative w-48 h-48 bg-zinc-900/50 rounded-3xl border border-white/5 p-4 overflow-hidden">
    <div className="grid grid-cols-2 gap-3 h-full">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`rounded-xl border border-white/5 flex items-center justify-center transition-colors ${i === 3 ? 'bg-blue-600/20 border-blue-600/50' : 'bg-white/5'}`}>
           <div className={`w-8 h-1 rounded-full ${i === 3 ? 'bg-blue-500' : 'bg-white/10'}`} />
        </div>
      ))}
    </div>
  </div>
);
