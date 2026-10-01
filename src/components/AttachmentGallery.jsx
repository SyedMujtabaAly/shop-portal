import { useEffect, useState } from 'react';
export default function AttachmentGallery({ attachments, emptyText }) {
  if (!attachments || attachments.length === 0) {
    return <p className="text-muted">{emptyText || 'Nothing attached.'}</p>;
  }

  return (
    <div className="gallery">
      {attachments.map((a) => (
        <Attachment key={a.id} attachment={a} />
      ))}
    </div>
  );
}

function Attachment({ attachment }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    if (!attachment.isImage || !attachment.exists) return;
    window.api.attachments.read(attachment.id).then((r) => {
      if (r.ok && r.data.inline) setDataUrl(r.data.dataUrl);
      else setFailed(r.message || 'Could not read the file.');
    });
  }, [attachment.id, attachment.isImage, attachment.exists]);

  if (!attachment.exists) {
    return (
      <div className="gallery__item gallery__item--missing">
        <strong>{attachment.originalName}</strong>
        <p className="text-muted text-small">
          File is missing from the data folder. It may have been deleted outside the software.
        </p>
      </div>
    );
  }

  return (
    <div className="gallery__item">
      {attachment.isImage ? (
        dataUrl ? (
          <img src={dataUrl} alt={attachment.originalName} className="gallery__img" />
        ) : (
          <div className="gallery__placeholder">{failed || 'Loading…'}</div>
        )
      ) : (
        <div className="gallery__placeholder">PDF</div>
      )}

      <div className="gallery__meta">
        <span className="text-small">{attachment.originalName}</span>
        <span className="text-muted text-small">{Math.round(attachment.sizeBytes / 1024)} KB</span>
        <button
          className="btn btn--small"
          onClick={() => window.api.attachments.open(attachment.id)}
        >
          Open full size
        </button>
      </div>
    </div>
  );
}
