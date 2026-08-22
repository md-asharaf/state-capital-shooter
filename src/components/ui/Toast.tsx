interface Props {
  toast: { msg: string; type: string } | null;
}

export default function Toast({ toast }: Props) {
  if (!toast) return null;
  return (
    <div className={`feedback-popup ${toast.type}`}>
      {toast.msg}
    </div>
  );
}
