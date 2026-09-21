<?php

namespace CurbSoftware\WpEloquent\Contracts\Support;

interface DeferringDisplayableValue
{
    /**
     * Resolve the displayable value that the class is deferring.
     *
     * @return \CurbSoftware\WpEloquent\Contracts\Support\Htmlable|string
     */
    public function resolveDisplayableValue();
}
