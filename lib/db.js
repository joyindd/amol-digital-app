'use client';

import { createClient } from '@supabase/supabase-js';

let client;

export function supabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    client = createClient(url, key);
  }
  return client;
}

// The shop this user belongs to. Everything is scoped to it.
export async function getOrg() {
  const { data, error } = await supabase().from('orgs').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRateItems(orgId) {
  const { data, error } = await supabase()
    .from('rate_items').select('*')
    .eq('org_id', orgId).eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function getCustomers(orgId) {
  const { data, error } = await supabase()
    .from('customers').select('*').eq('org_id', orgId).order('name');
  if (error) throw error;
  return data || [];
}

export async function nextDocNo(orgId, type, date) {
  const { data, error } = await supabase().rpc('next_doc_no', {
    p_org: orgId, p_type: type, p_date: date,
  });
  if (error) throw error;
  return data;
}

// Customer typed by name: reuse the existing record or create it once.
export async function findOrCreateCustomer(orgId, name, phone) {
  const clean = (name || '').trim();
  if (!clean) return null;
  const { data: found } = await supabase()
    .from('customers').select('id').eq('org_id', orgId).ilike('name', clean).limit(1);
  if (found && found.length) return found[0].id;
  const { data, error } = await supabase()
    .from('customers').insert({ org_id: orgId, name: clean, phone: phone || null })
    .select('id').single();
  if (error) throw error;
  return data.id;
}
