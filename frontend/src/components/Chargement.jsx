// Indicateur de chargement plein écran
export default function Chargement({ texte = 'Chargement…' }) {
  return (
    <div className="chargement-plein">
      <span className="spinner" />
      <span>{texte}</span>
    </div>
  );
}
