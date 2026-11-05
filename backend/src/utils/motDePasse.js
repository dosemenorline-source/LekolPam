// Comparaison de mot de passe à durée constante vis-à-vis de l'existence du
// compte : sans hash (compte inexistant, ou sans mot de passe), on compare
// quand même contre un hash factice de même coût — sinon la réponse rapide
// d'un compte inexistant révélerait, par le temps de réponse, quels courriels
// ou identifiants ont un compte.
import bcrypt from 'bcryptjs';

const HASH_FACTICE = bcrypt.hashSync('lekol-pam-compte-factice', 12);

export async function comparerMotDePasse(motDePasse, hash) {
  const ok = await bcrypt.compare(String(motDePasse || ''), hash || HASH_FACTICE);
  return Boolean(hash) && ok;
}
