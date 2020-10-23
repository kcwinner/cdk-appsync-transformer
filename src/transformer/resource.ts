export declare enum DataType {
    String = "String",
    Number = "Number",
    ListOfNumbers = "List<Number>",
    CommaDelimitedList = "CommaDelimitedList"
}
export declare class IntrinsicFunction {
    private name;
    private payload;
    constructor(name: string, payload: any);
    toJSON(): {
        [x: string]: any;
    };
}
export declare class ConditionIntrinsicFunction extends IntrinsicFunction {
    constructor(name: string, payload: any);
}
export declare type Value<T> = T | IntrinsicFunction;
export declare type List<T> = T[] | IntrinsicFunction;
export declare type Condition = ConditionIntrinsicFunction | {
    Condition: Value<string>;
};


export interface CreationPolicy {
    AutoScalingCreationPolicy?: {
        MinSuccessfulInstancesPercent?: Value<number>;
    };
    ResourceSignal?: {
        Count?: Value<number>;
        Timeout?: Value<string>;
    };
}

export declare enum DeletionPolicy {
    Delete = "Delete",
    Retain = "Retain",
    Snapshot = "Snapshot"
}

export interface UpdatePolicy {
    AutoScalingReplacingUpdate?: {
        WillReplace?: Value<boolean>;
    };
    AutoScalingRollingUpdate?: {
        MaxBatchSize?: Value<number>;
        MinInstancesInService?: Value<number>;
        MinSuccessfulInstancesPercent?: Value<number>;
        PauseTime?: Value<string>;
        SuspendProcesses?: List<string>;
        WaitOnResourceSignals?: Value<boolean>;
    };
    AutoScalingScheduledAction?: {
        IgnoreUnmodifiedGroupSizeProperties?: Value<boolean>;
    };
}

export interface Resource {
    Type: string;
    DependsOn?: Value<string> | List<string>;
    Properties?: {
        [key: string]: any;
    };
    Metadata?: {
        [key: string]: any;
    };
    CreationPolicy?: CreationPolicy;
    DeletionPolicy?: DeletionPolicy;
    UpdatePolicy?: UpdatePolicy;
    Condition?: Value<string>;
}