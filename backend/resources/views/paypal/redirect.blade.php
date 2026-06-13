<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Return to JamJade</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            align-items: center;
            background: #f8faff;
            color: #17315f;
            display: flex;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            justify-content: center;
            margin: 0;
            min-height: 100vh;
            padding: 24px;
        }

        main {
            background: #fff;
            border: 1px solid #dde8ff;
            border-radius: 28px;
            box-shadow: 0 18px 50px rgba(23, 49, 95, .12);
            max-width: 420px;
            padding: 32px 24px;
            text-align: center;
            width: 100%;
        }

        h1 {
            font-size: 25px;
            margin: 0 0 12px;
        }

        p {
            color: #6c7a96;
            line-height: 1.55;
            margin: 0;
        }

        a {
            background: #0070ba;
            border-radius: 999px;
            color: #fff;
            display: inline-block;
            font-weight: 800;
            margin-top: 24px;
            padding: 16px 24px;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <main>
        <h1>{{ $cancelled ? 'Payment Cancelled' : 'Payment Approved' }}</h1>
        <p>Returning you to the JamJade app to {{ $cancelled ? 'review the payment' : 'confirm your booking' }}.</p>
        <a href="{{ $appUrl }}">Return to JamJade</a>
    </main>
    <script>
        window.location.replace(@json($appUrl));
    </script>
</body>
</html>
