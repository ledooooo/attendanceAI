export const getBirthDataFromNationalID = (nid: string) => {
  if (!nid || nid.length !== 14) return { birthDate: 'غير متوفر', age: 0, retirementDate: 'غير متوفر' };

  const century = nid[0] === '2' ? '19' : '20';
  const year = nid.substring(1, 3);
  const month = nid.substring(3, 5);
  const day = nid.substring(5, 7);

  const birthDateStr = `${century}${year}-${month}-${day}`;
  const birthDate = new Date(birthDateStr);
  
  // حساب تاريخ التقاعد (سن 60)
  const retirementYear = parseInt(`${century}${year}`) + 60;
  const retirementDate = `${retirementYear}-${month}-${day}`;

  return { birthDate: birthDateStr, retirementDate };
};

// دالة لإضافة أشهر أو سنوات للتاريخ
export const addDuration = (dateStr: string, amount: number, unit: 'months' | 'years') => {
    if (!dateStr) return '.....';
    const date = new Date(dateStr);
    if (unit === 'months') date.setMonth(date.getMonth() + amount);
    if (unit === 'years') date.setFullYear(date.getFullYear() + amount);
    // إنقاص يوم واحد ليكون التاريخ دقيقاً (من 1/1 إلى 31/12)
    date.setDate(date.getDate() - 1); 
    return date.toISOString().split('T')[0];
};
