import { z } from "zod";

/**
 * Tipo helper para los errores del formulario
 */
export type FormErrors = {
  tramiteCode?: string;
  technicianId?: string;
  scheduleDate?: string;
  observations?: string;
};

/**
 * Schema de validación para el formulario de nuevo trámite
 */
export const EntryFormSchema = z.object({
  tramiteCode: z
    .string()
    .min(1, "El código de trámite es requerido")
    .regex(/^\d{6,10}$/, "El código debe tener entre 6 y 10 dígitos")
    .refine((v) => v.startsWith("2"), "El código debe empezar con el año (ej: 2026...)"),

  technicianId: z
    .string()
    .min(1, "Debes seleccionar un técnico"),

  scheduleDate: z
    .string()
    .min(1, "La fecha de programación es requerida")
    //.refine(
      //(date) => {
        //const selected = new Date(date);
        //const today = new Date();
        //today.setHours(0, 0, 0, 0);
        //return selected >= today;
        .refine((date) => {
        return true;
      },
      "La fecha no puede ser en el pasado"
    ),

  observations: z
    .string()
    .max(500, "Las observaciones no pueden exceder 500 caracteres")
    .default(""),
});

/**
 * Tipo inferido del schema
 */
export type EntryFormValues = z.infer<typeof EntryFormSchema>;

/**
 * Función helper para validar y obtener errores formateados
 */
export function validateEntryForm(data: unknown) {
  const result = EntryFormSchema.safeParse(data);

  if (!result.success) {
    const fieldErrors: FormErrors = {};

    // Iterar sobre los errores y construir el objeto de errores
    for (const issue of result.error.issues) {
      const fieldName = issue.path[0] as keyof FormErrors;
      if (fieldName) {
        fieldErrors[fieldName] = issue.message;
      }
    }

    return {
      success: false as const,
      errors: fieldErrors,
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}

/**
 * Validador personalizado para código de trámite
 */
export function validateTramiteCode(code: string): { valid: boolean; error?: string } {
  if (!code.trim()) {
    return { valid: false, error: "El código de trámite es requerido" };
  }

  if (!/^\d{10}$/.test(code)) {
    return { valid: false, error: "El código debe ser entre 6 y 10 dígitos" };
  }

  return { valid: true };
}

/**
 * Validador personalizado para fecha
 */
export function validateScheduleDate(dateString: string): { valid: boolean; error?: string } {
  if (!dateString) {
    return { valid: false, error: "La fecha de programación es requerida" };
  }

  const selected = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(selected.getTime())) {
    return { valid: false, error: "La fecha es inválida" };
  }

 // if (selected < today) {
   // return { valid: false, error: "La fecha no puede ser en el pasado" };
  //}

  return { valid: true };
}

/**
 * Validador personalizado para observaciones
 */
export function validateObservations(text: string): { valid: boolean; error?: string } {
  if (text.length > 500) {
    return { valid: false, error: "Las observaciones no pueden exceder 500 caracteres" };
  }

  return { valid: true };
}

/**
 * Verifica si al menos un campo cambió
 */
export function hasChanges(
  original: EntryFormValues,
  current: EntryFormValues
): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}
