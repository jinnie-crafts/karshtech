/**
 * KARSH TECH — UNIFIED FORM SUBMISSION & DELIVERY PIPELINE
 *
 * Provides robust validation, anti-spam honeypot protection, minimum completion time verification,
 * duplicate submission protection, and guaranteed delivery routing to official contact channels
 * (karshhtech@gmail.com via Web3Forms).
 */

export interface FormSubmissionPayload {
  name: string;
  email: string;
  category?: string;
  game?: string;
  subject: string;
  message: string;
  botcheck?: string;
  formStartedAt?: number;
  formType: 'contact' | 'support';
}

export interface FormSubmissionResult {
  success: boolean;
  message: string;
  deliveredVia: 'web3forms' | 'backend_audit';
}

const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Resolves the Web3Forms access key from the build-time environment.
 * The access key is a public form routing identifier baked into the client bundle at build time.
 */
export function getWeb3FormsKey(): string {
  const viteEnvKey =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.VITE_WEB3FORMS_ACCESS_KEY?.trim()
      : undefined;
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
  const nodeEnvKey =
    globalObj?.process?.env?.VITE_WEB3FORMS_ACCESS_KEY ||
    globalObj?.process?.env?.WEB3FORMS_ACCESS_KEY;

  return (viteEnvKey || nodeEnvKey || '').trim();
}

/**
 * Checks whether the backend/frontend reports form submission service is active.
 */
export async function isFormServiceConfigured(): Promise<boolean> {
  if (getWeb3FormsKey()) return true;
  try {
    const res = await fetch('/api/contact/config');
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.configured);
    }
  } catch {}
  return false;
}

/**
 * Validates form submission inputs client-side before attempting dispatch.
 */
export function validateFormInputs(data: FormSubmissionPayload): { valid: boolean; error?: string } {
  // 1. Honeypot spam check
  if (data.botcheck && data.botcheck.trim().length > 0) {
    return { valid: false, error: 'Spam detection triggered. Transmission rejected.' };
  }

  // 2. Minimum form-completion time verification (>= 3 seconds)
  if (data.formStartedAt !== undefined) {
    const elapsed = Date.now() - Number(data.formStartedAt);
    if (elapsed < 3000) {
      return {
        valid: false,
        error: 'Please take at least 3 seconds to review your inquiry before sending.',
      };
    }
  }

  const name = data.name.trim();
  const email = data.email.trim();
  const subject = data.subject.trim();
  const message = data.message.trim();

  // 3. Field length & format validation
  if (!name || name.length < 2) {
    return { valid: false, error: 'Please enter your full name (at least 2 characters).' };
  }
  if (name.length > 100) {
    return { valid: false, error: 'Name cannot exceed 100 characters.' };
  }

  if (!email || !STRICT_EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (email.length > 150) {
    return { valid: false, error: 'Email cannot exceed 150 characters.' };
  }

  if (!subject || subject.length < 2) {
    return { valid: false, error: 'Please enter a subject (at least 2 characters).' };
  }
  if (subject.length > 200) {
    return { valid: false, error: 'Subject cannot exceed 200 characters.' };
  }

  if (!message || message.length < 10) {
    return { valid: false, error: 'Please enter a detailed message (at least 10 characters).' };
  }
  if (message.length > 5000) {
    return { valid: false, error: 'Message cannot exceed 5,000 characters.' };
  }

  return { valid: true };
}

/**
 * Executes a resilient form submission via Web3Forms with strict backend rate limiting,
 * duplicate submission verification, and server audit logging.
 * Throws a descriptive error if transmission fails so that the UI NEVER shows false success.
 */
export async function submitKarshTechForm(payload: FormSubmissionPayload): Promise<FormSubmissionResult> {
  // 1. Client-side input validation
  const validation = validateFormInputs(payload);
  if (!validation.valid) {
    throw new Error(validation.error || 'Form validation failed.');
  }

  const trimmedName = payload.name.trim();
  const trimmedEmail = payload.email.trim().toLowerCase();
  const trimmedSubject = payload.subject.trim();
  const trimmedMessage = payload.message.trim();
  const topic = payload.category || payload.game || (payload.formType === 'support' ? 'Technical Support' : 'General Inquiry');
  const formStartedAt = payload.formStartedAt || Date.now();

  // 2. Pre-flight verification with Backend Audit & Rate Limiting Gate
  // This verifies rate limits (5 / 15m), honeypot, duplicate detection, and completion time
  // BEFORE consuming Web3Forms quota.
  const auditEndpoint = payload.formType === 'support' ? '/api/support' : '/api/contact';
  let backendVerified = false;

  try {
    const backendRes = await fetch(auditEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        category: payload.category,
        game: payload.game,
        subject: trimmedSubject,
        message: trimmedMessage,
        botcheck: payload.botcheck,
        formStartedAt,
      }),
    });

    if (backendRes.status === 429) {
      let msg = 'Rate limit exceeded. Please wait 15 minutes before sending another inquiry.';
      try {
        const body = await backendRes.json();
        msg = body.message || body.error || msg;
      } catch {}
      throw new Error(msg);
    }

    if (backendRes.status === 400) {
      let msg = 'Validation error occurred.';
      try {
        const body = await backendRes.json();
        msg = body.error || msg;
      } catch {}
      throw new Error(msg);
    }

    if (backendRes.ok) {
      backendVerified = true;
    }
  } catch (err: any) {
    // If it was an explicit rate-limit or validation error thrown above, re-throw to UI
    if (
      err.message?.includes('Rate limit') ||
      err.message?.includes('Duplicate submission') ||
      err.message?.includes('Submission received too quickly') ||
      err.message?.includes('Validation')
    ) {
      throw err;
    }
    // If backend network was temporarily unreachable, continue to provider dispatch
  }

  // 3. Resolve Web3Forms Access Key
  const accessKey = getWeb3FormsKey();

  if (!accessKey) {
    throw new Error(
      'Automated email transmission is currently unconfigured. Please email your inquiry directly to karshhtech@gmail.com.'
    );
  }

  // 4. Prepare Web3Forms Multipart Payload
  const formData = new FormData();
  formData.append('access_key', accessKey);
  formData.append('name', trimmedName);
  formData.append('email', trimmedEmail);
  formData.append(
    'subject',
    `[Karsh Tech — ${payload.formType === 'support' ? 'Support Ticket' : 'Project Inquiry'}] ${topic} : ${trimmedSubject}`
  );
  formData.append('category', topic);
  formData.append('message', trimmedMessage);
  formData.append('from_name', `${trimmedName} (via Karsh Tech Portal)`);
  if (payload.botcheck) {
    formData.append('botcheck', payload.botcheck);
  }

  // 5. Dispatch directly from browser to Web3Forms
  let response: Response;
  try {
    response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });
  } catch {
    throw new Error(
      'Network connection interrupted or blocked by client filter. Please retry or email karshhtech@gmail.com directly.'
    );
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (response.ok && data?.success === true) {
    return {
      success: true,
      message: data.message || 'Your transmission has been delivered to Karsh Tech.',
      deliveredVia: 'web3forms',
    };
  }

  // 6. If Web3Forms rejected or returned an error, FAIL OPEN to user: NEVER CLAIM FALSE SUCCESS!
  const serverReason = data?.message || `Provider status HTTP ${response.status}`;
  throw new Error(
    `Delivery could not be confirmed (${serverReason}). Please retry or email karshhtech@gmail.com directly.`
  );
}
