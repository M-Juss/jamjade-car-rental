<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>JamJade Admin invitation</title>
<style>
body{margin:0;background:#f8faff;color:#17315f;font-family:Arial,sans-serif;padding:24px}
main{max-width:420px;margin:8vh auto;padding:28px;background:white;border:1px solid #dde8ff;border-radius:16px}
h1{font-size:24px}label{display:block;margin:18px 0 6px}input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:8px;border:1px solid #dde8ff;font:inherit}
button{margin-top:24px;background:#346ef6;color:white;cursor:pointer}.error{color:#d92d20}
</style>
</head>
<body><main>
@if($accepted ?? false)
<h1>Admin account ready</h1><p>You can now sign in to JamJade using your email and password.</p>
@else
<h1>Accept Admin invitation</h1><p>{{ $invitation->email }}</p>
<form method="post">@csrf
<label for="name">Full name</label><input id="name" name="name" value="{{ old('name') }}" required maxlength="160" autocomplete="name" oninput="this.value=this.value.replace(/[^\p{L}\p{M} '\u2019-]/gu,'')">
@error('name')<p class="error">{{ $message }}</p>@enderror
<label for="password">Password</label><input id="password" type="password" name="password" required minlength="8" maxlength="72" autocomplete="new-password" pattern="(?=.*\p{Lu})(?=.*[^\p{L}\p{N}\s]).{8,72}" title="Use at least 8 characters, including 1 uppercase letter and 1 special character.">
<p>Use at least 8 characters, including 1 uppercase letter and 1 special character.</p>
@error('password')<p class="error">{{ $message }}</p>@enderror
<label for="password_confirmation">Confirm password</label><input id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password">
<button type="submit">Create Admin account</button>
</form>
@endif
</main></body></html>
