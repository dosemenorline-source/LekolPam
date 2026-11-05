// Contexte d'authentification — utilisateur courant + actions
import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((data) => setUtilisateur(data.utilisateur))
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }, []);

  // login peut renvoyer soit { utilisateur } (session ouverte), soit
  // { etape: '2fa_requis', courriel } pour les comptes parent (2FA par courriel).
  const login = async (payload) => {
    const data = await authApi.login(payload);
    if (data.utilisateur) setUtilisateur(data.utilisateur);
    return data;
  };

  // 2FA parent : valide le code reçu par courriel et ouvre la session.
  const verifierConnexion = async (code) => {
    const data = await authApi.verifierConnexion(code);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  const renvoyerCodeConnexion = () => authApi.renvoyerCodeConnexion();

  // Connexion biométrique (Face ID / Touch ID / Windows Hello) : ouvre la session
  // après vérification du passkey. `data` vient de connexionBiometrie().
  const connexionBiometrieOuvre = (data) => {
    if (data?.utilisateur) setUtilisateur(data.utilisateur);
    return data?.utilisateur;
  };

  // Connexion espace élève par code d'accès (sans courriel ni mot de passe)
  const eleveConnexion = async (code) => {
    const data = await authApi.eleveConnexion(code);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  // register ouvre directement la session : il n'y a plus d'étape de vérification
  const register = async (payload) => {
    const data = await authApi.register(payload);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  // Connexion/inscription Google : ouvre directement la session (l'adresse est
  // déjà vérifiée par Google, pas de 2FA supplémentaire).
  const googleLogin = async (credential) => {
    const data = await authApi.google(credential);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  const logout = async () => {
    await authApi.logout();
    setUtilisateur(null);
  };

  // Recharge le compte courant (ex. après changement de courriel)
  const rafraichir = async () => {
    const data = await authApi.me();
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, login, verifierConnexion, renvoyerCodeConnexion, connexionBiometrieOuvre, eleveConnexion, register, googleLogin, logout, rafraichir }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return ctx;
}
