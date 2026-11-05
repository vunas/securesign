// Helper for SweetAlert2 notifications and confirmations

type ToastIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

interface SwalOptions {
  title?: string;
  text?: string;
  html?: string;
  icon?: ToastIcon;
  showCancelButton?: boolean;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  customClass?: Record<string, string>;
  allowOutsideClick?: boolean;
  didOpen?: () => void;
  width?: number | string;
}

export function getSwal() {
  if (typeof window !== 'undefined' && (window as unknown as { Swal?: unknown }).Swal) {
    return (window as unknown as { Swal: {
      fire: (options: SwalOptions | string, text?: string, icon?: ToastIcon) => Promise<{ isConfirmed: boolean }>;
      showLoading: () => void;
      close: () => void;
      mixin: (config: unknown) => {
        fire: (options: { icon: ToastIcon; title: string }) => void;
      };
    } }).Swal;
  }
  return null;
}

export async function showAlert(title: string, text: string = '', icon: ToastIcon = 'info') {
  const Swal = getSwal();
  if (Swal) {
    return Swal.fire({
      icon,
      title,
      text,
      confirmButtonColor: '#4f46e5',
      customClass: {
        confirmButton: 'rounded-xl shadow-lg font-bold px-6 py-2.5',
      },
    });
  }
  alert(`${title}\n${text}`);
  return { isConfirmed: true };
}

export function showToast(message: string, icon: ToastIcon = 'success') {
  const Swal = getSwal();
  if (Swal) {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
    Toast.fire({ icon, title: message });
  } else {
    console.log(`[Toast ${icon}]: ${message}`);
  }
}

export async function showConfirm(options: SwalOptions): Promise<boolean> {
  const Swal = getSwal();
  if (Swal) {
    const result = await Swal.fire({
      ...options,
      customClass: {
        confirmButton: 'rounded-xl shadow-lg px-6 py-2.5 font-bold',
        cancelButton: 'rounded-xl px-6 py-2.5 font-bold',
        ...options.customClass,
      },
    });
    return result.isConfirmed;
  }
  return window.confirm(options.title || 'Bạn có chắc chắn muốn thực hiện?');
}

