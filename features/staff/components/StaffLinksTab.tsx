import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Link as LinkIcon, ExternalLink, Loader2, Globe } from 'lucide-react';

export default function StaffLinksTab() {
  const [links, setLinks] = useState<{name: string, url: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const { data } = await supabase
        .from('general_settings')
        .select('links_names, links_urls')
        .limit(1)
        .maybeSingle();

      if (data && data.links_names && data.links_urls) {
        // دمج المصفوفتين في مصفوفة كائنات واحدة
        const formattedLinks = data.links_names.map((name: string, index: number) => ({
          name: name,
          url: data.links_urls[index] || '#'
        }));
        setLinks(formattedLinks);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64 text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="bg-blue-100 p-2 rounded-xl">
          <LinkIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-black text-gray-800">الروابط الهامة</h3>
          <p className="text-xs text-gray-500">روابط ومواقع تهمك في العمل</p>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-[30px] border border-dashed border-gray-200">
          <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-bold">لا توجد روابط مضافة حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link, index) => (
            <a 
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group flex flex-col justify-between h-32"
            >
              <div className="flex justify-between items-start">
                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
              </div>
              <span className="font-bold text-gray-800 text-lg group-hover:text-blue-700 transition-colors line-clamp-2">
                {link.name}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
