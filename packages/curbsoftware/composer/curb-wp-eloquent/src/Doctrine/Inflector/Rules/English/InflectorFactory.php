<?php

declare(strict_types=1);

namespace CurbSoftware\WpEloquent\Doctrine\Inflector\Rules\English;

use CurbSoftware\WpEloquent\Doctrine\Inflector\GenericLanguageInflectorFactory;
use CurbSoftware\WpEloquent\Doctrine\Inflector\Rules\Ruleset;

final class InflectorFactory extends GenericLanguageInflectorFactory
{
    protected function getSingularRuleset() : Ruleset
    {
        return Rules::getSingularRuleset();
    }

    protected function getPluralRuleset() : Ruleset
    {
        return Rules::getPluralRuleset();
    }
}
