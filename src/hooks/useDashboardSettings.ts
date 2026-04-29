import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useDashboardSettings() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchLogo();
    
    const subscription = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'system_settings',
        filter: "key=eq.dashboard_logo_url" 
      }, (payload) => {
        if (payload.new && 'value' in payload.new) {
           setLogoUrl(payload.new.value as string);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'dashboard_logo_url')
        .maybeSingle();
      
      if (!error && data) {
        setLogoUrl(data.value);
      }
    } catch (e) {
      console.error("Error fetching logo:", e);
    }
  };

  return { logoUrl };
}
