<?php

namespace App\Enums;

enum VehicleConditionUpdateReason: string
{
    case CorrectionReinspection = 'correction_reinspection';
    case MaintenanceCompleted = 'maintenance_completed';
    case RepairCompleted = 'repair_completed';
    case RefuelingServicing = 'refueling_servicing';
    case IssueDiscovered = 'issue_discovered';
    case CompanyUse = 'company_use';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::CorrectionReinspection => 'Correction / Reinspection',
            self::MaintenanceCompleted => 'Maintenance Completed',
            self::RepairCompleted => 'Repair Completed',
            self::RefuelingServicing => 'Refueling / Servicing',
            self::IssueDiscovered => 'Issue Discovered',
            self::CompanyUse => 'Company Use',
            self::Other => 'Other',
        };
    }
}
