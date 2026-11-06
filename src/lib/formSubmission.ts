/**
 * KARSH TECH — UNIFIED FORM SUBMISSION & DELIVERY PIPELINE
 *
 * Provides robust validation, anti-spam honeypot protection, resilient access-key
 * resolution (build-time Vite env + runtime backend config fallback), and guaranteed
 * delivery routing to official contact channels (karshhtech@gmail.com via Web3Forms).
 */

export interface FormSubmissionPayload {
  name: string;
  email: string;
  category?: string;
  game?: string;
  subject: string;
  message: string;
  botcheck?: string;
  formType: 'contact' | 'support';
}

export interface FormSubmissionResult {
  success: boolean;
  message: string;
  deliveredVia: 'web3forms' | 'backend_audit';
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

let cachedRuntimeKey: string | null = null;

/**
 * Resolves the Web3Forms access key from build-time Vite environment variables
 * or dynamically from the backend runtime configuration if Vite env was not present at build.
 */
export async function getWeb3FormsKey(): Promise<string> {
  const buildKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY?.trim();
  if (buildKey) {
    return buildKey;
  }

  if (typeof cachedRuntimeKey === 'string' && cachedRuntimeKey.length > 0) {
    return cachedRuntimeKey;
  }

  try {
    const res = await fetch('/api/contact/config');
    if (res.ok) {
      const data = await res.json();
      if (data.key && typeof data.key === 'string') {
        const key = data.key.trim();
        cachedRuntimeKey = key;
        return key;
      }
    }
  } catch {
    // Network error fetching config
  }

  return '';
}

/**
 * Validates form submission inputs client-side before attempting dispatch.
 */
export function validateFormInputs(data: FormSubmissionPayload): { valid: boolean; error?: string } {
  // Honeypot spam check
  if (data.botcheck && data.botcheck.trim().length > 0) {
    return { valid: false, error: 'Spam detection triggered. Transmission rejected.' };
  }

  const name = data.name.trim();
  const email = data.email.trim();
  const subject = data.subject.trim();
  const message = data.message.trim();

  if (!name || name.length < 2) {
    return { valid: false, error: 'Please enter your full name (at least 2 characters).' };
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  if (!subject || subject.length < 2) {
    return { valid: false, error: 'Please enter a subject (at least 2 characters).' };
  }

  if (!message || message.length < 10) {
    return { valid: false, error: 'Please enter a detailed message (at least 10 characters).' };
  }

  return { valid: true };
}

/**
 * Executes a resilient form submission via Web3Forms with concurrent backend audit logging.
 * Throws a descriptive error if transmission fails so that the UI NEVER shows false success.
 */
export async function submitKarshTechForm(payload: FormSubmissionPayload): Promise<FormSubmissionResult> {
  // 1. Client-side input validation
  const validation = validateFormInputs(payload);
  if (!validation.valid) {
    throw new Error(validation.error || 'Form validation failed.');
  }

  const trimmedName = payload.name.trim();
  const trimmedEmail = payload.email.trim();
  const trimmedSubject = payload.subject.trim();
  const trimmedMessage = payload.message.trim();
  const topic = payload.category || payload.game || (payload.formType === 'support' ? 'Technical Support' : 'General Inquiry');

  // 2. Resolve Web3Forms Access Key
  const accessKey = await getWeb3FormsKey();

  if (!accessKey) {
    // If no access key is configured anywhere, log to backend and throw transparently
    try {
      await fetch(payload.formType === 'support' ? '/api/support' : '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          category: payload.category,
          game: payload.game,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });
    } catch {}

    throw new Error(
      'Automated transmission service is temporarily unconfigured. Please email your inquiry directly to karshhtech@gmail.com.'
    );
  }

  // 3. Prepare Web3Forms Multipart Payload
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

  // 4. Concurrently trigger backend audit logging (non-blocking)
  const auditPromise = fetch(payload.formType === 'support' ? '/api/support' : '/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: trimmedName,
      email: trimmedEmail,
      category: payload.category,
      game: payload.game,
      subject: trimmedSubject,
      message: trimmedMessage,
    }),
  }).catch(() => {});

  // 5. Dispatch to Web3Forms
  let response: Response;
  try {
    response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });
  } catch (err: any) {
    await auditPromise;
    throw new Error(
      'Network connection interrupted or blocked by privacy filter. Please retry or email karshhtech@gmail.com directly.'
    );
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response (e.g. 403 or 502 HTML)
  }

  await auditPromise;

  if (response.ok && data?.success === true) {
    return {
      success: true,
      message: data.message || 'Your transmission has been delivered to Karsh Tech.',
      deliveredVia: 'web3forms',
    };
  }

  // If Web3Forms rejected or returned an error, FAIL OPEN to user: DO NOT CLAIM SUCCESS!
  const serverReason = data?.message || `Provider status HTTP ${response.status}`;
  throw new Error(
    `Delivery could not be confirmed (${serverReason}). Please retry or email karshhtech@gmail.com directly.`
  );
}
