/**
 * Reemplazar con tipos reales corriendo:
 *   npx supabase gen types typescript --project-id TU_ID --schema public > src/types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      ingenieros: {
        Row: { id: string; nombre: string; apellido: string | null; matricula: string | null; telefono: string | null; email: string | null; logo_url: string | null; created_at: string };
        Insert: { id: string; nombre: string; apellido?: string | null; matricula?: string | null; telefono?: string | null; email?: string | null; logo_url?: string | null };
        Update: Partial<Database['public']['Tables']['ingenieros']['Insert']>;
      };
      campanas: {
        Row: { id: string; ingeniero_id: string; nombre: string; fecha_inicio: string; fecha_fin: string; activa: boolean; created_at: string };
        Insert: { ingeniero_id: string; nombre: string; fecha_inicio: string; fecha_fin: string; activa?: boolean; id?: string };
        Update: Partial<Database['public']['Tables']['campanas']['Insert']>;
      };
      productores: {
        Row: { id: string; ingeniero_id: string; razon_social: string; cuit: string | null; telefono: string | null; email: string | null; localidad: string | null; activo: boolean; created_at: string };
        Insert: { ingeniero_id: string; razon_social: string; cuit?: string | null; telefono?: string | null; email?: string | null; localidad?: string | null; activo?: boolean; id?: string };
        Update: Partial<Database['public']['Tables']['productores']['Insert']>;
      };
      lotes: {
        Row: { id: string; productor_id: string; campana_id: string; nombre: string; hectareas: number; cultivo: string | null; cultivo_2: string | null; variedad: string | null; fecha_siembra: string | null; notas: string | null; created_at: string };
        Insert: { productor_id: string; campana_id: string; nombre: string; hectareas: number; cultivo?: string | null; cultivo_2?: string | null; variedad?: string | null; fecha_siembra?: string | null; notas?: string | null; id?: string };
        Update: Partial<Database['public']['Tables']['lotes']['Insert']>;
      };
      acuerdos: {
        Row: { id: string; productor_id: string; campana_id: string; modalidad: string; monto_unitario: number | null; descripcion: string | null; created_at: string };
        Insert: { productor_id: string; campana_id: string; modalidad: string; monto_unitario?: number | null; descripcion?: string | null; id?: string };
        Update: Partial<Database['public']['Tables']['acuerdos']['Insert']>;
      };
      pagos: {
        Row: { id: string; acuerdo_id: string; fecha: string; monto: number; medio: string | null; observaciones: string | null; created_at: string };
        Insert: { acuerdo_id: string; fecha?: string; monto: number; medio?: string | null; observaciones?: string | null; id?: string };
        Update: Partial<Database['public']['Tables']['pagos']['Insert']>;
      };
      recorridas: {
        Row: { id: string; productor_id: string; campana_id: string; lote_id: string | null; fecha: string; cultivo: string | null; estado_cultivo: string | null; observaciones: string | null; recomendacion: string | null; created_at: string };
        Insert: { productor_id: string; campana_id: string; lote_id?: string | null; fecha?: string; cultivo?: string | null; estado_cultivo?: string | null; observaciones?: string | null; recomendacion?: string | null; id?: string };
        Update: Partial<Database['public']['Tables']['recorridas']['Insert']>;
      };
      recetas: {
        Row: { id: string; ingeniero_id: string; lote_id: string; fecha_emision: string; fecha_aplicacion: string | null; cultivo: string | null; estado_cultivo: string | null; objetivo: string | null; volumen_caldo: number | null; observaciones: string | null; created_at: string };
        Insert: { ingeniero_id: string; lote_id: string; fecha_emision?: string; fecha_aplicacion?: string | null; cultivo?: string | null; estado_cultivo?: string | null; objetivo?: string | null; volumen_caldo?: number | null; observaciones?: string | null; id?: string };
        Update: Partial<Database['public']['Tables']['recetas']['Insert']>;
      };
      receta_items: {
        Row: { id: string; receta_id: string; producto_nombre: string; principio_activo: string | null; dosis: number; unidad: string; orden: number };
        Insert: { receta_id: string; producto_nombre: string; principio_activo?: string | null; dosis: number; unidad?: string; orden?: number; id?: string };
        Update: Partial<Database['public']['Tables']['receta_items']['Insert']>;
      };
      analisis: {
        Row: { id: string; lote_id: string; fecha: string; laboratorio: string | null; ph: number | null; mo: number | null; p_bray: number | null; n_total: number | null; s_sulfatos: number | null; observaciones: string | null; created_at: string };
        Insert: { lote_id: string; fecha?: string; laboratorio?: string | null; ph?: number | null; mo?: number | null; p_bray?: number | null; n_total?: number | null; s_sulfatos?: number | null; observaciones?: string | null; id?: string };
        Update: Partial<Database['public']['Tables']['analisis']['Insert']>;
      };
    };
    Views: {
      vw_productor_has: {
        Row: { productor_id: string; campana_id: string; hectareas_total: number; cantidad_lotes: number; cultivos: string[] | null; cultivos_2: string[] | null };
      };
      vw_cobranza: {
        Row: { productor_id: string; campana_id: string; modalidad: string; monto_unitario: number | null; total_cobrado: number; estado: string };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
