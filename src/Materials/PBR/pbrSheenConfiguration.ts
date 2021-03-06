import { SerializationHelper, serialize, expandToProperty, serializeAsColor3, serializeAsTexture } from "../../Misc/decorators";
import { EffectFallbacks } from "../../Materials/effect";
import { UniformBuffer } from "../../Materials/uniformBuffer";
import { Color3 } from "../../Maths/math";
import { Scene } from "../../scene";
import { MaterialFlags } from "../../Materials/materialFlags";
import { MaterialHelper } from "../../Materials/materialHelper";
import { BaseTexture } from "../../Materials/Textures/baseTexture";
import { IAnimatable } from "../../Misc/tools";
import { Nullable } from "../../types";

/**
 * @hidden
 */
export interface IMaterialSheenDefines {
    SHEEN: boolean;
    SHEEN_TEXTURE: boolean;
    SHEEN_TEXTUREDIRECTUV: number;
    SHEEN_LINKWITHALBEDO: boolean;

    /** @hidden */
    _areTexturesDirty: boolean;
}

/**
 * Define the code related to the Sheen parameters of the pbr material.
 */
export class PBRSheenConfiguration {

    @serialize()
    private _isEnabled = false;
    /**
     * Defines if the material uses sheen.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public isEnabled = false;

    @serialize()
    private _linkSheenWithAlbedo = false;
    /**
     * Defines if the sheen is linked to the sheen color.
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public linkSheenWithAlbedo = false;

    /**
     * Defines the sheen intensity.
     */
    @serialize()
    public intensity = 1;

    /**
     * Defines the sheen color.
     */
    @serializeAsColor3()
    public color = Color3.White();

    @serializeAsTexture()
    private _texture: Nullable<BaseTexture> = null;
    /**
     * Stores the sheen tint values in a texture.
     * rgb is tint
     * a is a intensity
     */
    @expandToProperty("_markAllSubMeshesAsTexturesDirty")
    public texture: Nullable<BaseTexture> = null;

    /** @hidden */
    private _internalMarkAllSubMeshesAsTexturesDirty: () => void;

    /** @hidden */
    public _markAllSubMeshesAsTexturesDirty(): void {
        this._internalMarkAllSubMeshesAsTexturesDirty();
    }

    /**
     * Instantiate a new istance of clear coat configuration.
     * @param markAllSubMeshesAsTexturesDirty Callback to flag the material to dirty
     */
    constructor(markAllSubMeshesAsTexturesDirty: () => void) {
        this._internalMarkAllSubMeshesAsTexturesDirty = markAllSubMeshesAsTexturesDirty;
    }

    /**
     * Specifies that the submesh is ready to be used.
     * @param defines the list of "defines" to update.
     * @param scene defines the scene the material belongs to.
     * @returns - boolean indicating that the submesh is ready or not.
     */
    public isReadyForSubMesh(defines: IMaterialSheenDefines, scene: Scene): boolean {
        if (defines._areTexturesDirty) {
            if (scene.texturesEnabled) {
                if (this._texture && MaterialFlags.SheenTextureEnabled) {
                    if (!this._texture.isReadyOrNotBlocking()) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /**
     * Checks to see if a texture is used in the material.
     * @param defines the list of "defines" to update.
     * @param scene defines the scene the material belongs to.
     */
    public prepareDefines(defines: IMaterialSheenDefines, scene: Scene): void {
        if (this._isEnabled) {
            defines.SHEEN = this._isEnabled;
            defines.SHEEN_LINKWITHALBEDO = this._linkSheenWithAlbedo;

            if (defines._areTexturesDirty) {
                if (scene.texturesEnabled) {
                    if (this._texture && MaterialFlags.SheenTextureEnabled) {
                        MaterialHelper.PrepareDefinesForMergedUV(this._texture, defines, "SHEEN_TEXTURE");
                    } else {
                        defines.SHEEN_TEXTURE = false;
                    }
                }
            }
        }
        else {
            defines.SHEEN = false;
            defines.SHEEN_TEXTURE = false;
            defines.SHEEN_LINKWITHALBEDO = false;
        }
    }

    /**
     * Binds the material data.
     * @param uniformBuffer defines the Uniform buffer to fill in.
     * @param scene defines the scene the material belongs to.
     * @param isFrozen defines wether the material is frozen or not.
     */
    public bindForSubMesh(uniformBuffer: UniformBuffer, scene: Scene, isFrozen: boolean): void {
        if (!uniformBuffer.useUbo || !isFrozen || !uniformBuffer.isSync) {
            if (this._texture && MaterialFlags.SheenTextureEnabled) {
                uniformBuffer.updateFloat2("vSheenInfos", this._texture.coordinatesIndex, this._texture.level);
                MaterialHelper.BindTextureMatrix(this._texture, uniformBuffer, "sheen");
            }

            // Sheen
            uniformBuffer.updateFloat4("vSheenColor",
                this.color.r,
                this.color.g,
                this.color.b,
                this.intensity);
        }

        // Textures
        if (scene.texturesEnabled) {
            if (this._texture && MaterialFlags.SheenTextureEnabled) {
                uniformBuffer.setTexture("sheenSampler", this._texture);
            }
        }
    }

    /**
     * Checks to see if a texture is used in the material.
     * @param texture - Base texture to use.
     * @returns - Boolean specifying if a texture is used in the material.
     */
    public hasTexture(texture: BaseTexture): boolean {
        if (this._texture === texture) {
            return true;
        }

        return false;
    }

    /**
     * Returns an array of the actively used textures.
     * @param activeTextures Array of BaseTextures
     */
    public getActiveTextures(activeTextures: BaseTexture[]): void {
        if (this._texture) {
            activeTextures.push(this._texture);
        }
    }

    /**
     * Returns the animatable textures.
     * @param animatables Array of animatable textures.
     */
    public getAnimatables(animatables: IAnimatable[]): void {
        if (this._texture && this._texture.animations && this._texture.animations.length > 0) {
            animatables.push(this._texture);
        }
    }

    /**
     * Disposes the resources of the material.
     * @param forceDisposeTextures - Forces the disposal of all textures.
     */
    public dispose(forceDisposeTextures?: boolean): void {
        if (forceDisposeTextures) {
            if (this._texture) {
                this._texture.dispose();
            }
        }
    }

    /**
    * Get the current class name of the texture useful for serialization or dynamic coding.
    * @returns "PBRSheenConfiguration"
    */
    public getClassName(): string {
        return "PBRSheenConfiguration";
    }

    /**
     * Add fallbacks to the effect fallbacks list.
     * @param defines defines the Base texture to use.
     * @param fallbacks defines the current fallback list.
     * @param currentRank defines the current fallback rank.
     * @returns the new fallback rank.
     */
    public static AddFallbacks(defines: IMaterialSheenDefines, fallbacks: EffectFallbacks, currentRank: number): number {
        if (defines.SHEEN) {
            fallbacks.addFallback(currentRank++, "SHEEN");
        }
        return currentRank;
    }

    /**
     * Add the required uniforms to the current list.
     * @param uniforms defines the current uniform list.
     */
    public static AddUniforms(uniforms: string[]): void {
        uniforms.push("vSheenColor", "vSheenInfos", "sheenMatrix");
    }

    /**
     * Add the required uniforms to the current buffer.
     * @param uniformBuffer defines the current uniform buffer.
     */
    public static PrepareUniformBuffer(uniformBuffer: UniformBuffer): void {
        uniformBuffer.addUniform("vSheenColor", 4);
        uniformBuffer.addUniform("vSheenInfos", 2);
        uniformBuffer.addUniform("sheenMatrix", 16);
    }

    /**
     * Add the required samplers to the current list.
     * @param samplers defines the current sampler list.
     */
    public static AddSamplers(samplers: string[]): void {
        samplers.push("sheenSampler");
    }

    /**
     * Makes a duplicate of the current configuration into another one.
     * @param sheenConfiguration define the config where to copy the info
     */
    public copyTo(sheenConfiguration: PBRSheenConfiguration): void {
        SerializationHelper.Clone(() => sheenConfiguration, this);
    }

    /**
     * Serializes this BRDF configuration.
     * @returns - An object with the serialized config.
     */
    public serialize(): any {
        return SerializationHelper.Serialize(this);
    }

    /**
     * Parses a Sheen Configuration from a serialized object.
     * @param source - Serialized object.
     */
    public parse(source: any): void {
        SerializationHelper.Parse(() => this, source, null);
    }
}