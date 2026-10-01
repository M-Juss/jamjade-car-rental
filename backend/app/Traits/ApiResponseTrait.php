<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Pagination\LengthAwarePaginator;

trait ApiResponseTrait
{
    protected function success(
        string $message = 'Success',
        mixed $data = null,
        int $status = 200,
        ?array $meta = null
    ): JsonResponse {
        $body = [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ];

        if ($meta !== null) {
            $body['meta'] = $meta;
        }

        return response()->json($body, $status);
    }

    protected function created(
        string $message = 'Created successfully',
        mixed $data = null
    ): JsonResponse {
        return $this->success($message, $data, 201);
    }

    protected function noData(
        string $message = 'Action completed',
        int $status = 200
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => null,
        ], $status);
    }

    protected function paginated(
        string $message,
        LengthAwarePaginator $paginator,
        string|JsonResource|null $resourceClass = null,
        array $extraMeta = []
    ): JsonResponse {
        $items = $resourceClass
            ? $resourceClass::collection($paginator->getCollection())->resolve()
            : $paginator->items();

        return $this->success($message, $items, 200, array_merge([
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ], $extraMeta));
    }

    protected function error(
        string $message = 'Something went wrong',
        array $errors = [],
        int $status = 400
    ): JsonResponse {
        $body = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== []) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }
}
