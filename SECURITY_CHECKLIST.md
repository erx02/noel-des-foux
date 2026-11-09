# Checklist de sécurité avant publication

## Supabase et PostgreSQL

- [ ] Appliquer et relire la migration sur le bon projet Supabase.
- [ ] Vérifier que l'inscription publique est désactivée et la confirmation
  d'adresse e-mail activée.
- [ ] Créer/inviter chaque membre avec un compte individuel ; aucun compte ou mot
  de passe familial partagé.
- [ ] Provisionner le premier admin uniquement depuis le SQL Editor opérateur.
- [ ] Vérifier RLS activée et forcée sur les quatre tables, et aucun privilège
  `anon` sur les données ou fonctions métier.
- [ ] Ne pas exposer le schéma `private` dans la configuration API PostgREST.
- [ ] Confirmer que `reservations` n'est pas dans la publication
  `supabase_realtime` ; elle doit rester exclue pour éviter la fuite de statut.
- [ ] Exécuter `supabase test db` sur une base locale fraîche et vérifier chaque
  assertion pgTAP.
- [ ] Tester avec des comptes séparés : anonyme, deux familles, membre, admin,
  propriétaire et réservataire ; inclure des appels REST directs et vérifier
  réponses et payloads réseau.
- [ ] Vérifier qu'un propriétaire ne peut pas obtenir les réservations via une
  requête directe, un compteur, Realtime, une jointure, une vue ou une erreur.
- [ ] Garder toute clé `service_role` hors du frontend, du dépôt et des variables
  de build `VITE_*`.

## Frontend et déploiement

- [ ] Renseigner seulement les variables GitHub Actions publiques
  `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- [ ] Vérifier qu'aucun fichier `.env.local` ni aucune donnée réelle n'est
  committé.
- [ ] Exécuter `npm run build` et corriger toute erreur TypeScript ou Vite.
- [ ] Créer/committer `package-lock.json` puis utiliser `npm ci` dans le workflow.
- [ ] Vérifier la configuration GitHub Pages **GitHub Actions**, le workflow et
  le chemin de base sur l'URL publique finale.
- [ ] Configurer seulement les URL de redirection Auth nécessaires (local et
  URL exacte de production).
- [ ] Vérifier la CSP en production, notamment que les domaines Auth/Realtime
  du projet sont autorisés et qu'aucun script tiers n'est chargé.
- [ ] Vérifier qu'aucune image distante ne se charge automatiquement, qu'aucun
  tracker n'est présent et que les liens utilisent une politique de référence
  stricte.
- [ ] Tester clavier, lecteur d'écran, contraste, largeur 320 px et préférence
  `prefers-reduced-motion`.
- [ ] Examiner la limite des en-têtes de sécurité GitHub Pages. Ne pas prétendre
  que la balise meta protège contre l'iframe ni qu'elle remplace les en-têtes
  HTTP.
- [ ] Faire vérifier le déploiement et les permissions par une seconde personne
  avant d'inviter la famille.

## Configuration initiale

- [ ] Ne mettre aucune donnée familiale ou fixture personnelle dans le dépôt.
- [ ] Ne pas activer de fonctions ou privilèges SQL non examinés.
- [ ] S'assurer que l'administrateur sait que les invitations et promotions de
  rôle restent des opérations du tableau de bord Supabase.
