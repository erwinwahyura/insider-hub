import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to get current user ID
export async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

// Portfolio functions
export async function getUserPortfolios(userId: string) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function addPortfolio(userId: string, portfolio: {
  ticker: string;
  name: string;
  sector: string;
  lots: number;
  avg_price: number;
  conviction?: string;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('portfolios')
    .insert([{
      user_id: userId,
      ...portfolio
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updatePortfolio(portfolioId: string, updates: {
  lots?: number;
  avg_price?: number;
  conviction?: string;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from('portfolios')
    .update(updates)
    .eq('id', portfolioId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deletePortfolio(portfolioId: string) {
  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', portfolioId);
  
  if (error) throw error;
}

// Alert functions
export async function getUserAlerts(userId: string) {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function addAlert(userId: string, alert: {
  ticker: string;
  alert_type: string;
  target_price: number;
  message: string;
  priority?: string;
  cooldown_minutes?: number;
}) {
  const { data, error } = await supabase
    .from('price_alerts')
    .insert([{
      user_id: userId,
      ...alert,
      is_active: true
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteAlert(alertId: string) {
  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', alertId);
  
  if (error) throw error;
}
