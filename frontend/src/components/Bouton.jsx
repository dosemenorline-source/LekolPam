// Bouton réutilisable
export default function Bouton({ variante = 'primaire', bloc, sm, enCours, children, ...props }) {
  const classes = [
    'btn',
    `btn-${variante}`,
    bloc ? 'btn-bloc' : '',
    sm ? 'btn-sm' : '',
  ].filter(Boolean).join(' ');

  return (
    // disabled APRÈS {...props} : un disabled={false} explicite ne doit jamais
    // réactiver un bouton en cours d'envoi (double-clic).
    <button className={classes} {...props} disabled={enCours || props.disabled}>
      {enCours && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
      {children}
    </button>
  );
}
