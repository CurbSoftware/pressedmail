<?php

namespace CurbSoftware\WpEloquent\Contracts\Support;

interface MessageProvider
{
    /**
     * Get the messages for the instance.
     *
     * @return \CurbSoftware\WpEloquent\Contracts\Support\MessageBag
     */
    public function getMessageBag();
}
