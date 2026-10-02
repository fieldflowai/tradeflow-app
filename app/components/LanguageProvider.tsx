"use client";

import { cloneElement, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { createClient } from "@/app/utils/supabase/client";

export type Language = "en" | "es";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };

const LanguageContext = createContext<LanguageContextValue | null>(null);
const storageKey = "tradeflow-language";

const spanish: Record<string, string> = {
  "Estimates": "Cotizaciones", "Schedule & jobs": "Agenda y trabajos", "Schedule & job tracking": "Agenda y seguimiento de trabajos",
  "Schedule": "Agenda", "Price book": "Lista de precios", "Price book & templates": "Lista de precios y plantillas", "Reports": "Informes",
  "+ New estimate": "+ Nueva cotización", "+ New Estimate": "+ Nueva cotización", "New estimate": "Nueva cotización",
  "Sign in": "Iniciar sesión", "Create account": "Crear cuenta", "Sign out": "Cerrar sesión", "Signed in as": "Sesión iniciada como",
  "Profile & preferences": "Perfil y preferencias", "Profile & Preferences": "Perfil y preferencias", "Language": "Idioma", "English": "Inglés", "Spanish": "Español", "Español": "Español",
  "WorkCraft AI Dashboard": "Panel de WorkCraft AI", "Manage estimates, tracking, and payments": "Administra cotizaciones, trabajos y pagos",
  "Plan upcoming work and keep every job moving.": "Planifica el trabajo y mantén cada tarea en marcha.",
  "Operations": "Operaciones", "Active jobs": "Trabajos activos", "On the schedule today": "Programados para hoy", "Completed jobs": "Trabajos completados",
  "Schedule work": "Programar trabajo", "From estimate (optional)": "Desde una cotización aprobada (opcional)", "Create a job without an estimate": "Crear un trabajo sin cotización",
  "Job name": "Nombre del trabajo", "Customer": "Cliente", "Customer email": "Correo del cliente", "Job address": "Dirección del trabajo", "Date and time": "Fecha y hora", "Job notes": "Notas del trabajo", "Save scheduled job": "Guardar trabajo programado", "Saving…": "Guardando…", "Close": "Cerrar", "+ Schedule a job": "+ Programar trabajo",
  "Job board": "Tablero de trabajos", "Loading jobs…": "Cargando trabajos…", "No jobs scheduled yet": "Aún no hay trabajos programados", "Create a job or schedule work from one of your estimates.": "Crea un trabajo o programa uno desde una cotización aprobada.",
  "Scheduled": "Programado", "In progress": "En curso", "Completed": "Completado", "Cancelled": "Cancelado", "Update status": "Actualizar estado", "Delete job": "Eliminar trabajo", "Reschedule": "Cambiar fecha", "Actual job cost": "Costo real del trabajo", "Open estimate": "Abrir cotización", "Create / view invoice": "Crear / ver factura", "No customer": "Sin cliente", "No date set": "Sin fecha establecida", "Replace kitchen faucet": "Reemplazar grifo de cocina", "Access details, materials to bring, or customer requests": "Detalles de acceso, materiales o solicitudes del cliente",
  "Manage your account details and default estimate preferences.": "Administra tu cuenta y las preferencias predeterminadas de tus cotizaciones.", "Your plan": "Tu plan", "WorkCraft AI Pro": "WorkCraft AI Pro", "WorkCraft AI Free": "WorkCraft AI Gratis", "Pro tools are enabled on this account.": "Las herramientas Pro están activas en esta cuenta.", "Create estimates, manage your price book, schedule jobs, and view reports.": "Crea cotizaciones, administra precios, programa trabajos y consulta informes.", "Upgrade to Pro": "Mejorar a Pro",
  "Email Address (Read-only)": "Correo electrónico (solo lectura)", "Full Name": "Nombre completo", "Business / Company Name": "Nombre de la empresa", "Business address": "Dirección de la empresa", "Public logo URL (optional)": "URL pública del logotipo (opcional)", "Proposal accent color": "Color de acento de la propuesta", "Phone Number": "Teléfono", "Default estimate pricing": "Precios predeterminados de cotizaciones", "Applied to new estimates as a starting point. Tax rules vary by location; confirm what is taxable with your tax professional.": "Se aplican como punto de partida a nuevas cotizaciones. Las reglas de impuestos varían; confirma qué está sujeto a impuestos con un profesional.", "Markup (%)": "Recargo (%)", "Sales tax (%)": "Impuesto sobre ventas (%)", "Save Preferences": "Guardar preferencias", "Saving Changes...": "Guardando cambios...", "Profile and preferences updated successfully!": "¡Perfil y preferencias actualizados!",
  "Create an estimate": "Crear una cotización", "Build a clear, editable quote for your next job.": "Prepara una cotización clara y editable para tu próximo trabajo.", "WorkCraft AI / Estimates": "WorkCraft AI / Cotizaciones", "Draft · Unsaved": "Borrador · Sin guardar", "Unfinished estimate": "Cotización sin terminar", "Save or restore a draft in this browser on this device.": "Guarda o restaura un borrador en este navegador y dispositivo.", "Save on this device": "Guardar en este dispositivo", "Restore saved draft": "Restaurar borrador", "Clear saved draft": "Borrar borrador guardado", "Client Information": "Información del cliente", "Trade": "Oficio", "Client Name *": "Nombre del cliente *", "Client Email *": "Correo del cliente *", "Client Phone": "Teléfono del cliente", "Job Address": "Dirección del trabajo", "Plumbing": "Plomería", "Electrical": "Electricidad", "Roofing": "Techado", "HVAC": "Climatización", "Painting": "Pintura", "Carpentry": "Carpintería", "General contracting": "Contratación general", "Other": "Otro",
  "Field photos & voice note": "Fotos del trabajo y nota de voz", "Attach up to 6 job photos and one recorded voice note. These are saved privately and only photos appear on the proposal.": "Adjunta hasta 6 fotos y una nota de voz. Se guardan de forma privada; solo las fotos aparecen en la propuesta.", "Add photos": "Agregar fotos", "Record voice note": "Grabar nota de voz", "Stop recording": "Detener grabación", "Recording… Tap “Stop recording” to attach it.": "Grabando… Pulsa «Detener grabación» para adjuntarla.", "Remove": "Quitar",
  "Generative AI Assistant (Pro)": "Asistente de IA generativa (Pro)", "Smart Local Estimator (Free)": "Estimador local inteligente (Gratis)", "Cloud AI": "IA en la nube", "Zero Cost": "Sin costo", "Draft Line Items": "Preparar partidas", "Drafting...": "Preparando...", "Scope & Line Items": "Alcance y partidas", "+ Add from price book": "+ Agregar de lista de precios", "Close price book": "Cerrar lista de precios", "+ Add Custom Line": "+ Agregar partida personalizada", "Item or service description": "Descripción del artículo o servicio", "Qty": "Cant.", "Rate": "Precio", "Save this scope as a reusable template": "Guardar este alcance como plantilla", "Save template": "Guardar plantilla", "Good / Better / Best options": "Opciones Bueno / Mejor / Óptimo", "Add three options": "Agregar tres opciones", "Remove options": "Quitar opciones", "Package total": "Total del paquete", "Describe what's included": "Describe lo que incluye", "Require Down-Payment / Deposit": "Requerir anticipo", "Require Down-Payment / Deposit (Pro)": "Requerir anticipo (Pro)", "Subtotal:": "Subtotal:", "Required Deposit": "Anticipo requerido", "Estimate total:": "Total de la cotización:", "Save & Generate Client Proposal Link": "Guardar y crear enlace de propuesta", "Generating Share Link...": "Creando enlace para compartir...", "Customer proposal language": "Idioma de la propuesta para el cliente", "English proposal": "Propuesta en inglés", "Spanish proposal": "Propuesta en español", "Spanish description (optional)": "Descripción en español (opcional)",
  "Service Estimate": "Cotización de servicio", "Total Estimate": "Total de la cotización", "Created on": "Creada el", "Prepared For": "Preparada para", "Job Location": "Ubicación del trabajo", "Address not specified": "Dirección no especificada", "Scope of Work": "Alcance del trabajo", "Description": "Descripción", "Amount": "Importe", "Subtotal": "Subtotal", "Total": "Total", "Tax": "Impuesto", "Markup": "Recargo", "Print / Save PDF": "Imprimir / Guardar PDF", "Choose the option that fits your home": "Elige la opción adecuada para tu hogar", "Select one package to approve.": "Selecciona una opción para aprobar.", "Good": "Bueno", "Better": "Mejor", "Best": "Óptimo", "Have a question about this proposal?": "¿Tienes alguna pregunta sobre esta propuesta?", "Send it directly to": "Envíala directamente a", "Your email will be used so they can reply.": "Usaremos tu correo para que puedan responderte.", "Your name": "Tu nombre", "Email": "Correo electrónico", "Question": "Pregunta", "Send question": "Enviar pregunta", "Sending…": "Enviando…", "Type your full name to approve": "Escribe tu nombre completo para aprobar", "Full name": "Nombre completo", "Typing your name records your approval of this estimate.": "Al escribir tu nombre, registras la aprobación de esta cotización.", "Recording Approval...": "Registrando aprobación...", "Your approval has been recorded. The contractor will contact you about payment and next steps.": "Tu aprobación quedó registrada. El contratista se comunicará contigo sobre el pago y los próximos pasos.", "Approve Estimate": "Aprobar cotización", "Dashboard": "Panel", "Edit Estimate": "Editar cotización", "Status:": "Estado:", "pending": "Pendiente", "accepted": "Aprobada", "paid": "Pagada", "declined": "Rechazada",
  "Active Estimates": "Cotizaciones activas", "Archived": "Archivadas", "No active estimates found.": "No hay cotizaciones activas.", "No archived estimates found.": "No hay cotizaciones archivadas.", "Client": "Cliente", "Created": "Creada", "Actions": "Acciones", "Send estimate": "Enviar cotización", "View proposal": "Ver propuesta", "Archive": "Archivar", "Unarchive": "Restaurar", "Customer questions": "Preguntas de clientes", "unread": "sin leer", "Mark read": "Marcar como leída",
  "Privacy": "Privacidad", "Terms": "Términos", "Support": "Ayuda", "WorkCraft AI · Your workday, in better flow.": "WorkCraft AI · Tu jornada laboral, con mejor ritmo.", "View": "Ver", "Create your first estimate to see business reports here.": "Crea tu primera cotización para consultar informes aquí.", "Unable to View Proposal": "No se puede ver la propuesta", "Return to Dashboard": "Volver al panel",
  "Create Account": "Crear cuenta", "Sign up to get started with your account": "Regístrate para comenzar con tu cuenta", "Sign in to your account": "Inicia sesión en tu cuenta", "Email address": "Correo electrónico", "Password": "Contraseña", "Confirm Password": "Confirmar contraseña", "Forgot password?": "¿Olvidaste tu contraseña?", "Sign In": "Iniciar sesión", "Sign up": "Regístrate", "Don't have an account?": "¿No tienes una cuenta?", "Already have an account?": "¿Ya tienes una cuenta?", "Reset password": "Restablecer contraseña", "Send reset link": "Enviar enlace de restablecimiento",
  "Estimate pricing": "Precios de la cotización", "Markup is applied before sales tax. Check local tax rules for taxable labor and materials.": "El recargo se aplica antes del impuesto sobre ventas. Confirma las reglas locales para mano de obra y materiales.", "Spanish description for ": "Descripción en español para ", "Some work descriptions remain in the contractor’s original language because Spanish wording was not provided.": "Algunas descripciones aparecen en el idioma original porque el contratista no proporcionó una versión en español.",
  "Tax must be between 0 and 100%, and markup between 0 and 500%.": "El impuesto debe estar entre 0 y 100%, y el recargo entre 0 y 500%.", "Your question was sent to the contractor. They can reply to your email address.": "Tu pregunta se envió al contratista. Puede responder a tu correo electrónico.", "Your question was saved. The contractor can see it in WorkCraft AI; email notification is not currently available.": "Tu pregunta se guardó. El contratista puede verla en WorkCraft AI; las notificaciones por correo no están disponibles ahora.",
  "No line items are attached. Invoice total uses the saved job amount.": "No hay partidas. El total de la factura usa el importe guardado del trabajo.", "Invoice": "Factura", "Invoice status": "Estado de la factura", "Draft": "Borrador", "Sent": "Enviada", "Total due": "Total a pagar", "Bill to": "Facturar a", "Back to jobs": "Volver a trabajos", "Preparing invoice…": "Preparando factura…", "Job not found. Check that the operations migration has been applied and that you own this job.": "No se encontró el trabajo. Verifica que se haya aplicado la migración de operaciones y que seas su propietario.",
  "Schedule this approved job": "Programar este trabajo aprobado", "This estimate has already been added to your job schedule.": "Esta cotización ya se agregó a tu agenda de trabajos.", "From approved estimate (optional)": "Desde una cotización aprobada (opcional)", "Only approved estimates can be converted to jobs.": "Solo las cotizaciones aprobadas se pueden convertir en trabajos.", "Approved estimate not found.": "No se encontró la cotización aprobada.", "Only an approved estimate can be converted to a job.": "Solo una cotización aprobada se puede convertir en trabajo.", "Sign in to schedule this estimate.": "Inicia sesión para programar esta cotización.",
  "The file upload is private.": "La carga del archivo es privada.", "Private contractor voice notes": "Notas de voz privadas del contratista", "Only signed-in account owners can load these recordings.": "Solo los propietarios de la cuenta con sesión iniciada pueden escuchar estas grabaciones.", "Tax (%)": "Impuesto (%)", "Sales tax": "Impuesto sobre ventas",
  "Booking": "Reservas", "Business overview": "Resumen del negocio", "Understand your estimate pipeline and completed work.": "Consulta el estado de tus cotizaciones y trabajos completados.", "Refresh": "Actualizar", "Jobs & schedule": "Trabajos y agenda", "Pipeline": "Embudo de ventas", "Estimate status": "Estado de la cotización", "Pending": "Pendiente", "Accepted": "Aprobada", "Declined": "Rechazada", "Gross profit": "Ganancia bruta", "Completed job value": "Valor de trabajos completados", "Estimate conversion": "Conversión de cotizaciones",
  "Your browser could not save the draft. Check available device storage.": "No se pudo guardar el borrador en este navegador. Revisa el almacenamiento disponible.", "No saved draft found in this browser.": "No se encontró un borrador guardado en este navegador.", "Could not restore this saved draft. Save a new draft to replace it.": "No se pudo restaurar el borrador. Guarda uno nuevo para reemplazarlo.", "Saved device draft and attachments removed.": "Se eliminaron el borrador y los archivos adjuntos guardados en el dispositivo.",
};

export function translate(language: Language, text: string): string {
  if (language !== "es") return text;
  if (spanish[text]) return spanish[text];
  if (text.startsWith("Spanish description for ")) return `Descripción en español para ${text.slice("Spanish description for ".length)}`;
  return text;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const initial = saved === "es" || saved === "en" ? saved : navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    setLanguageState(initial);
    document.documentElement.lang = initial;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const preferred = data.user?.user_metadata?.app_language;
      if (preferred === "es" || preferred === "en") {
        setLanguageState(preferred);
        localStorage.setItem(storageKey, preferred);
        document.documentElement.lang = preferred;
      }
    });
  }, []);

  const setLanguage = useCallback((value: Language) => {
    setLanguageState(value);
    localStorage.setItem(storageKey, value);
    document.documentElement.lang = value;
    const supabase = createClient();
    void supabase.auth.updateUser({ data: { app_language: value } });
  }, []);

  const contextValue = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LocalizedTree({ children, languageOverride }: { children: ReactNode; languageOverride?: Language }) {
  const { language } = useLanguage();
  const activeLanguage = languageOverride ?? language;
  const visit = (node: ReactNode): ReactNode => {
    if (typeof node === "string") return translate(activeLanguage, node);
    if (Array.isArray(node)) return node.map((child) => visit(child));
    if (!node || typeof node !== "object" || !("props" in node)) return node;
    const element = node as ReactElement<Record<string, unknown>>;
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(element.props)) {
      if (key === "children") continue;
      if (typeof value === "string" && key !== "value" && key !== "href" && key !== "src") props[key] = translate(activeLanguage, value);
      else props[key] = value;
    }
    return cloneElement(element, props, visit(element.props.children as ReactNode));
  };
  return <>{visit(children)}</>;
}
