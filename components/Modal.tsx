'use client';
import { useEffect } from 'react';

type ModalProps = { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; };

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div aria-modal="true" role="dialog"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 14,
                 boxShadow: '0 10px 30px rgba(0,0,0,0.2)', padding: 20 }}>
        {title && <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</h2>}
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
