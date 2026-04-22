<?php

declare(strict_types=1);

// Petite page de verification visuelle quand on ouvre backend/public.
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>UrbainElikyaDRC Backend</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; line-height: 1.5; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Backend PHP actif</h1>
  <p>Ce dossier contient les endpoints de test en JSON.</p>
  <p>Exemple endpoint: <code>/backend/api/stats/dashboard.php</code></p>
</body>
</html>
