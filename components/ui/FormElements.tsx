import React from 'react';

export const Input = ({ label, type = 'text', value, onChange, placeholder, required = false, disabled = false }: any) => (
  <div className="text-right w-full">
    {label && <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label} {required && <span className="text-red-500">*</span>}</label>}
    <input 
      type={type} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400" 
      placeholder={placeholder} 
    />
  </div>
);

export const Select = ({ label, options, value, onChange, disabled = false }: any) => (
  <div className="text-right w-full">
    {label && <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>}
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100"
    >
      <option value="">-- اختر --</option>
      {options.map((opt: any) => 
        typeof opt === 'string' 
          ? <option key={opt} value={opt}>{opt}</option> 
          : <option key={opt.value} value={opt.value}>{opt.label}</option>
      )}
    </select>
  </div>
);