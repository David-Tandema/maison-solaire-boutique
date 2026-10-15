# DAVID — Maison Solaire

Boutique statique publiée sur GitHub Pages, avec catalogue, commandes et espace de gestion hébergés dans Supabase.

## Services

- Site public : `https://david-tandema.github.io/maison-solaire-boutique/`
- Base et authentification : projet Supabase `david-maison-solaire` (région Europe)
- Le fichier `supabase-config.js` contient uniquement l’URL du projet et sa clé publishable, destinées à être visibles dans un site web.
- Ne jamais ajouter une clé `service_role`, un mot de passe de base de données ou un secret privé aux fichiers du site.

## Base de données

Le schéma et les produits de démonstration sont dans `supabase-setup.sql`. Pour installer ou réinstaller le schéma, exécuter ce fichier dans le SQL Editor du projet Supabase. La migration active RLS, limite les modifications du catalogue aux administrateurs et réserve la lecture des commandes aux administrateurs. La création d’une commande passe par une fonction SQL qui recalcule les prix depuis le catalogue.

## Accès administrateur

1. Dans Supabase, ouvrir **Authentication → Users → Add user** et créer le compte administrateur avec l’adresse e-mail de l’entreprise.
2. Dans le SQL Editor, accorder l’accès à cette adresse (remplacer l’adresse entre apostrophes) :

   ```sql
   insert into public.store_admins (user_id)
   select id from auth.users where email = lower('votre-email@example.com')
   on conflict do nothing;
   ```

3. Ouvrir `https://david-tandema.github.io/maison-solaire-boutique/#admin` et se connecter avec ce compte.

L’espace de gestion permet d’ajouter/modifier/masquer des produits et de consulter les commandes ou d’en mettre à jour le statut. Les commandes restent en attente de paiement : aucun paiement en ligne n’est intégré.
