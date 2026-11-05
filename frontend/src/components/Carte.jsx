// Carte (conteneur)
export default function Carte({ titre, children, ...props }) {
  return (
    <div className="carte" {...props}>
      {titre && <h3 className="carte-titre">{titre}</h3>}
      {children}
    </div>
  );
}
