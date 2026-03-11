<?php

include("../utils/json.php");

$sig=readJson("../data/signaler.json");
$idees=readJson("../data/idees.json");

$stats=[

"signalements"=>count($sig),
"idees"=>count($idees)

];

echo json_encode($stats);

?>