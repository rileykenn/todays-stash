'use client';

import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabaseBrowser';

export default function MerchantProfile() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const merchantId = process.env.NEXT_PUBLIC_MERCHANT_ID!;

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    const path = `${merchantId}/photo-${Date.now()}.jpg`;

    // upload to bucket
    const { error } = await sb.storage
      .from('merchant-media')
      .upload(path, file, { upsert: true });

    if (error) {
      alert(error.message);
      setUploading(false);
      return;
    }

    // get public URL
    const { data } = sb.storage.from('merchant-media').getPublicUrl(path);
    const photoUrl = data.publicUrl;

    // save to merchants table
    const { error: updateError } = await sb
      .from('merchants')
      .update({ photo_url: photoUrl })
      .eq('id', merchantId);

    setUploading(false);

    if (updateError) {
      alert(updateError.message);
    } else {
      alert('Photo updated!');
      setPreview(photoUrl);
    }
  }

  useEffect(() => {
    async function loadCurrentPhoto() {
      const { data } = await sb
        .from('merchants')
        .select('photo_url')
        .eq('id', merchantId)
        .single();
      if (data?.photo_url) setPreview(data.photo_url);
    }
    loadCurrentPhoto();
  }, [merchantId]);

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Merchant Profile
      </h1>

      {preview && (
        <div style={{ marginBottom: 16 }}>
          <img
            src={preview}
            alt="Current business photo"
            style={{ width: '100%', maxWidth: 300, borderRadius: 12 }}
          />
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        disabled={uploading}
        style={{
          marginTop: 12,
          padding: '10px 14px',
          borderRadius: 10,
          background: '#10b981',
          color: 'white',
          fontWeight: 600,
        }}
      >
        {uploading ? 'Uploading…' : 'Upload Photo'}
      </button>
    </main>
  );
}
