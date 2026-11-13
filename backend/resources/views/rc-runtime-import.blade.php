<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Install RC model</title></head>
<body><h1>Install RC model</h1><form method="post" enctype="multipart/form-data">
@csrf
<label for="model">Runtime model JSON</label><input id="model" name="model" type="file" accept=".json,application/json" required>
<button type="submit">Install model</button>
</form></body></html>
