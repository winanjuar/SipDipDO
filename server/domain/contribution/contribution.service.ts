/**
 * CONTRIBUTION — item, realisasi, periode & cut-off (FR-8–FR-10).
 *
 * Cut-off membekukan snapshot poin sah per owner per periode (imutabel,
 * AD-10); writer entries menolak menulis ke periode berstatus final;
 * koreksi pasca cut-off masuk periode berikut sebagai penyesuaian carry-over.
 *
 * TODO(Epic 5): tabel contribution_items/entries/periods; transisi finalisasi
 * periode atomik dengan pembekuan snapshot.
 */
export {}
