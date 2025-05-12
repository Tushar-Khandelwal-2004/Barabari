import { RubricItem } from '../types/rubrics';

export function validateRubrics(rubrics: RubricItem[]): boolean {
    if (!Array.isArray(rubrics) || rubrics.length === 0) {
        return false;
    }

    for (const rubric of rubrics) {
        if (!rubric.category || !rubric.criteria ||
            !rubric.description || typeof rubric.weight !== 'number') {
            return false;
        }

        if (rubric.weight < 0 || rubric.weight > 100) {
            return false;
        }
    }

    const totalWeight = rubrics.reduce((sum, rubric) => sum + rubric.weight, 0);
    return Math.abs(totalWeight - 100) < 0.01;
}
