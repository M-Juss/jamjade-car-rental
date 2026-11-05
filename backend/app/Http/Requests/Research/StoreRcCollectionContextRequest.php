<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Validator;

class StoreRcCollectionContextRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        $rules = [
            'contract_version' => ['required', 'in:rc-collection-v1'],
            'recording_id' => ['required', 'uuid'], 'manifest_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
            'session' => ['required', 'array:id,device_profile_id,session_number,recording_group_id,opened_at,conditions,preset_id,catalog_version,operator_code'],
            'session.id' => ['required', 'uuid'], 'session.device_profile_id' => ['required', 'uuid'],
            'session.session_number' => ['required', 'integer', 'between:1,999999999'],
            'session.recording_group_id' => ['required', 'uuid'], 'session.opened_at' => ['required', 'date'],
            'session.conditions' => ['required', 'array:surface,slope'],
            'session.conditions.surface' => ['required', 'string', 'max:100'], 'session.conditions.slope' => ['required', 'in:level,uphill,downhill'],
            'session.preset_id' => ['required', 'in:mn82s_roof_v1'], 'session.catalog_version' => ['required', 'in:rc-exercises-v1'],
            'session.operator_code' => ['required', 'regex:/^OP[0-9]{2,4}$/D'],
            'mount' => ['required', 'array:id,research_session_id,mount_number,reason,created_at,preset_id,alignment_status'],
            'mount.id' => ['required', 'uuid'], 'mount.research_session_id' => ['required', 'uuid'],
            'mount.mount_number' => ['required', 'integer', 'between:1,999999'],
            'mount.reason' => ['required', 'in:initial,remounted,repositioned,suspected_shift'], 'mount.created_at' => ['required', 'date'],
            'mount.preset_id' => ['required', 'in:mn82s_roof_v1'], 'mount.alignment_status' => ['required', 'in:pending'],
            'capture_number' => ['required', 'integer', 'between:1,999999999'],
            'protocol_code' => ['required', 'in:FSS,HA,HB,LT,RT,RSS,SW,SR,FR'],
            'catalog_version' => ['required', 'in:rc-exercises-v1'], 'protocol_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
            'preflight' => ['required', 'array:id,mount_version_id,clock_context_id,consent_version,consented_at,started_at,start_elapsed_ns,end_elapsed_ns,summary_method_version,criteria_version,holder_locked,phone_top_forward,rc_still,window_ms,measurements,checks,result'],
            'preflight.id' => ['required', 'uuid'], 'preflight.mount_version_id' => ['required', 'uuid'], 'preflight.clock_context_id' => ['required', 'uuid'],
            'preflight.consent_version' => ['required', 'in:rc-preflight-v1'], 'preflight.consented_at' => ['required', 'date'],
            'preflight.started_at' => ['required', 'date'], 'preflight.summary_method_version' => ['required', 'in:rest-welford-v1'],
            'preflight.criteria_version' => ['present', 'prohibited'],
            'preflight.window_ms' => ['required', 'numeric', 'between:5000,30000'],
            'preflight.start_elapsed_ns' => ['required', 'regex:/^[1-9][0-9]{0,18}$/D'], 'preflight.end_elapsed_ns' => ['required', 'regex:/^[1-9][0-9]{0,18}$/D'],
            'preflight.checks' => ['required', 'array:sensors,timing,orientation,stability'],
            'preflight.checks.sensors' => ['required', 'in:passed'],
            'preflight.checks.timing' => ['required', 'in:inconclusive'], 'preflight.checks.orientation' => ['required', 'in:inconclusive'],
            'preflight.checks.stability' => ['required', 'in:inconclusive'], 'preflight.result' => ['required', 'in:inconclusive'],
            'preflight.measurements' => ['required', 'array:accelerometer,gyroscope'],
        ];
        foreach (['holder_locked', 'phone_top_forward', 'rc_still'] as $field) {
            $rules["preflight.$field"] = ['required', 'accepted'];
        }
        foreach (['accelerometer', 'gyroscope'] as $channel) {
            $key = "preflight.measurements.$channel";
            $rules[$key] = ['required', 'array:count,rejected_count,mean,std,rms,rate_hz,max_gap_ms'];
            $rules["$key.count"] = ['required', 'integer', 'between:2,100000'];
            $rules["$key.rejected_count"] = ['required', 'integer', 'in:0'];
            foreach (['mean', 'std'] as $vector) {
                $rules["$key.$vector"] = ['required', 'array', 'list', 'size:3'];
                $rules["$key.$vector.*"] = ['required', 'numeric', $vector === 'std' ? 'min:0' : 'min:-100000', 'max:100000'];
            }
            foreach (['rms', 'rate_hz', 'max_gap_ms'] as $field) {
                $rules["$key.$field"] = ['required', 'numeric', 'min:0', 'max:100000'];
            }
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $p = $this->input('preflight');
            $start = $p['start_elapsed_ns'];
            $end = $p['end_elapsed_ns'];
            $max = (string) PHP_INT_MAX;
            $overflow = strlen($start) > strlen($max) || (strlen($start) === strlen($max) && strcmp($start, $max) > 0)
                || strlen($end) > strlen($max) || (strlen($end) === strlen($max) && strcmp($end, $max) > 0);
            if ($overflow || (int) $end <= (int) $start || abs(((int) $end - (int) $start) / 1e6 - $p['window_ms']) > 0.001) {
                $validator->errors()->add('preflight.end_elapsed_ns', 'Setup check timing is inconsistent.');
            }
            if (CarbonImmutable::parse($p['consented_at'])->gt(CarbonImmutable::parse($p['started_at'])) || CarbonImmutable::parse($this->input('session.opened_at'))->gt(CarbonImmutable::parse($this->input('mount.created_at')))
                || CarbonImmutable::parse($this->input('mount.created_at'))->gt(CarbonImmutable::parse($p['started_at']))) {
                $validator->errors()->add('preflight.started_at', 'Setup check times must follow consent and mounting.');
            }
            if ($this->input('mount.research_session_id') !== $this->input('session.id') || $p['mount_version_id'] !== $this->input('mount.id')) {
                $validator->errors()->add('mount.id', 'Setup references must belong to this session and mount.');
            }
        });
    }
}
